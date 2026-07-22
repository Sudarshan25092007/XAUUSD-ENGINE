//+------------------------------------------------------------------+
//|                                              ExecutionBridge.mq5 |
//|                                  Copyright 2026, Solo Dev Engine |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Solo Dev Engine"
#property version   "3.00"
#property strict

#include <Trade/Trade.mqh>

// --- Native TCP Variables ---
int socket_handle = INVALID_HANDLE;
string server_ip = "127.0.0.1";
int server_port = 5555;
CTrade trade;
string recv_buffer = "";        // Persistent buffer for newline-delimited framing
uint   last_recv_time = 0;      // Timestamp of last data received (for timeout)
// --- Risk Constants ---
double LOT_SIZE = 0.01;
double SL_FALLBACK = 3.00;  // 300 pips fallback if SL=0
double TP_FALLBACK = 6.00;  // 600 pips fallback if TP=0

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
   Print(">>> Native Execution Bridge v3.0 (SL/TP Enforced)");
   EventSetMillisecondTimer(100);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   if(socket_handle != INVALID_HANDLE) SocketClose(socket_handle);
   EventKillTimer();
   Print("🛑 [BRIDGE OFFLINE] ExecutionBridge terminated.");
}

//+------------------------------------------------------------------+
//| Called on every new tick from the broker                          |
//+------------------------------------------------------------------+
void OnTick() {
   if(socket_handle == INVALID_HANDLE) return;

   MqlTick last_tick;
   if(!SymbolInfoTick(Symbol(), last_tick)) return;

   string tick_json = StringFormat(
      "{\"type\": \"TICK\", \"symbol\": \"%s\", \"bid\": %.5f, \"ask\": %.5f, \"last\": %.5f, \"volume\": %d, \"time_msc\": %I64d}",
      Symbol(),
      last_tick.bid,
      last_tick.ask,
      last_tick.last,
      last_tick.volume,
      last_tick.time_msc
   );
   tick_json += "\n";

   uchar send_buffer[];
   StringToCharArray(tick_json, send_buffer, 0, WHOLE_ARRAY, CP_UTF8);
   int buf_size = ArraySize(send_buffer);
   if(buf_size > 0 && send_buffer[buf_size-1] == 0)
      ArrayResize(send_buffer, buf_size - 1);

   if(SocketSend(socket_handle, send_buffer, ArraySize(send_buffer)) < 0) {
      Print("🔥 [TICK PUSH FAILED] SocketSend error: ", GetLastError());
      SocketClose(socket_handle);
      socket_handle = INVALID_HANDLE;
   }
}

//+------------------------------------------------------------------+
//| Parse a double value from JSON string                            |
//+------------------------------------------------------------------+
double ParseJsonDouble(string &json, string key) {
   string search = "\"" + key + "\": ";
   int pos = StringFind(json, search);
   if(pos == -1) {
      search = "\"" + key + "\":";  // no space variant
      pos = StringFind(json, search);
   }
   if(pos == -1) return 0.0;

   int start = pos + StringLen(search);
   // Find end of number (comma, }, or space)
   int end = start;
   int json_len = StringLen(json);
   while(end < json_len) {
      ushort ch = StringGetCharacter(json, end);
      if(ch == ',' || ch == '}' || ch == ' ' || ch == '\n' || ch == '\r')
         break;
      end++;
   }
   string val = StringSubstr(json, start, end - start);
   return StringToDouble(val);
}

//+------------------------------------------------------------------+
//| Close all positions of a given type (BUY or SELL)                |
//+------------------------------------------------------------------+
void CloseAllPositions(ENUM_POSITION_TYPE pos_type) {
   string type_str = (pos_type == POSITION_TYPE_BUY) ? "BUY" : "SELL";
   int closed = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != Symbol()) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == pos_type) {
         if(trade.PositionClose(ticket)) {
            closed++;
            Print("🔥 [CLOSED] ", type_str, " ticket #", ticket);
         } else {
            Print("❌ [CLOSE FAILED] ", type_str, " ticket #", ticket, " Error: ", GetLastError());
         }
      }
   }
   Print("🔥 [CLEANUP] Closed ", closed, " ", type_str, " positions.");
}

//+------------------------------------------------------------------+
//| Count positions and send sync response to Python                 |
//+------------------------------------------------------------------+
void SendPositionSync() {
   int buy_count = 0, sell_count = 0;
   double buy_pnl = 0, sell_pnl = 0;

   for(int i = 0; i < PositionsTotal(); i++) {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != Symbol()) continue;

      double profit = PositionGetDouble(POSITION_PROFIT);
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) {
         buy_count++;
         buy_pnl += profit;
      } else {
         sell_count++;
         sell_pnl += profit;
      }
   }

   string sync_json = StringFormat(
      "{\"type\": \"POSITION_SYNC\", \"buy_count\": %d, \"sell_count\": %d, \"buy_pnl\": %.2f, \"sell_pnl\": %.2f, \"total_pnl\": %.2f}\n",
      buy_count, sell_count, buy_pnl, sell_pnl, buy_pnl + sell_pnl
   );

   uchar sync_buf[];
   StringToCharArray(sync_json, sync_buf, 0, WHOLE_ARRAY, CP_UTF8);
   int buf_size = ArraySize(sync_buf);
   if(buf_size > 0 && sync_buf[buf_size-1] == 0)
      ArrayResize(sync_buf, buf_size - 1);

   SocketSend(socket_handle, sync_buf, ArraySize(sync_buf));
   Print("📊 [SYNC] Sent to Python: BUY=", buy_count, " SELL=", sell_count, " P/L=$", buy_pnl + sell_pnl);
}

//+------------------------------------------------------------------+
//| Enforce SL/TP on a position via PositionModify (fallback)        |
//+------------------------------------------------------------------+
void EnforceSLTP(ulong ticket, double sl, double tp) {
   if(ticket == 0) return;
   if(!PositionSelectByTicket(ticket)) return;

   double current_sl = PositionGetDouble(POSITION_SL);
   double current_tp = PositionGetDouble(POSITION_TP);

   // Only modify if SL or TP is missing
   if(current_sl == 0.0 || current_tp == 0.0) {
      if(trade.PositionModify(ticket, sl, tp)) {
         Print("🛡️ [SL/TP ENFORCED] Ticket #", ticket, " SL=", sl, " TP=", tp);
      } else {
         Print("❌ [MODIFY FAILED] Ticket #", ticket, " Error: ", GetLastError());
      }
   }
}

//+------------------------------------------------------------------+
//| Send ORDER_FAILED event to Python with error details             |
//+------------------------------------------------------------------+
void SendOrderFailed(string order_type, int error_code, double price, double sl, double tp) {
   string err_desc;
   switch(error_code) {
      case 10006: err_desc = "Request rejected"; break;
      case 10013: err_desc = "Invalid request"; break;
      case 10014: err_desc = "Invalid volume"; break;
      case 10015: err_desc = "Invalid price"; break;
      case 10016: err_desc = "Invalid stops"; break;
      case 10019: err_desc = "Not enough money"; break;
      case 10021: err_desc = "No prices"; break;
      case 10030: err_desc = "Invalid fill type"; break;
      default: err_desc = "Error code " + IntegerToString(error_code); break;
   }
   string fail_json = StringFormat(
      "{\"type\": \"ORDER_FAILED\", \"order_type\": \"%s\", \"error\": \"%s\", \"code\": %d, \"price\": %.5f, \"sl\": %.5f, \"tp\": %.5f}\n",
      order_type, err_desc, error_code, price, sl, tp
   );
   uchar fail_buf[];
   StringToCharArray(fail_json, fail_buf, 0, WHOLE_ARRAY, CP_UTF8);
   int buf_size = ArraySize(fail_buf);
   if(buf_size > 0 && fail_buf[buf_size-1] == 0)
      ArrayResize(fail_buf, buf_size - 1);
   SocketSend(socket_handle, fail_buf, ArraySize(fail_buf));
   Print("\xF0\x9F\x9B\x91 [ORDER_FAILED] Sent to Python: ", order_type, " error=", err_desc, " code=", error_code);
}

//+------------------------------------------------------------------+
//| Ensure SL/TP respect broker's minimum stop distance              |
//+------------------------------------------------------------------+
void EnforceStopLevel(double price, double &sl, double &tp, string direction) {
   int stop_level = (int)SymbolInfoInteger(Symbol(), SYMBOL_TRADE_STOPS_LEVEL);
   double point = SymbolInfoDouble(Symbol(), SYMBOL_POINT);
   double min_distance = stop_level * point;

   if(min_distance > 0) {
      double buffer = min_distance * 1.5;  // 50% safety margin
      if(direction == "BUY") {
         if(MathAbs(price - sl) < buffer) {
            sl = price - buffer;
            Print("\xF0\x9F\x94\xA7 [STOP LEVEL] Adjusted BUY SL to ", sl, " (min_dist=", min_distance, ")");
         }
         if(MathAbs(tp - price) < buffer) {
            tp = price + buffer;
            Print("\xF0\x9F\x94\xA7 [STOP LEVEL] Adjusted BUY TP to ", tp, " (min_dist=", min_distance, ")");
         }
      } else {
         if(MathAbs(sl - price) < buffer) {
            sl = price + buffer;
            Print("\xF0\x9F\x94\xA7 [STOP LEVEL] Adjusted SELL SL to ", sl, " (min_dist=", min_distance, ")");
         }
         if(MathAbs(price - tp) < buffer) {
            tp = price - buffer;
            Print("\xF0\x9F\x94\xA7 [STOP LEVEL] Adjusted SELL TP to ", tp, " (min_dist=", min_distance, ")");
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Send ORDER_FILLED event to Python                                |
//+------------------------------------------------------------------+
void SendOrderFilled(ulong ticket, string order_type) {
   string fill_json = StringFormat(
      "{\"type\": \"ORDER_FILLED\", \"ticket\": %I64u, \"order_type\": \"%s\"}\n",
      ticket, order_type
   );
   uchar fill_buf[];
   StringToCharArray(fill_json, fill_buf, 0, WHOLE_ARRAY, CP_UTF8);
   int buf_size = ArraySize(fill_buf);
   if(buf_size > 0 && fill_buf[buf_size-1] == 0)
      ArrayResize(fill_buf, buf_size - 1);
   SocketSend(socket_handle, fill_buf, ArraySize(fill_buf));
   Print("\xF0\x9F\x93\xA8 [ORDER_FILLED] Sent to Python: ticket #", ticket, " type=", order_type);
}

//+------------------------------------------------------------------+
//| Timer: connection + signal handling                              |
//+------------------------------------------------------------------+
void OnTimer() {
   // --- AUTO-CONNECT ---
   if(socket_handle == INVALID_HANDLE) {
      socket_handle = SocketCreate();
      if(socket_handle != INVALID_HANDLE) {
         if(!SocketConnect(socket_handle, server_ip, server_port, 1000)) {
            Print("❌ Connection Failed. Error: ", GetLastError());
            SocketClose(socket_handle);
            socket_handle = INVALID_HANDLE;
         } else {
            Print("✅ [NATIVE BRIDGE] Connected to Python Engine on port ", server_port);
         }
      }
   }

   // --- READ INCOMING SIGNALS FROM PYTHON (buffered, newline-delimited) ---
   if(socket_handle != INVALID_HANDLE) {
      uint len = SocketIsReadable(socket_handle);
      if(len > 0) {
         uchar raw_bytes[];
         int read_len = SocketRead(socket_handle, raw_bytes, len, 100);
         if(read_len > 0) {
            recv_buffer += CharArrayToString(raw_bytes, 0, read_len);
            last_recv_time = GetTickCount();
         }
      }

      // Process all complete messages (newline-delimited)
      int newline_pos;
      while((newline_pos = StringFind(recv_buffer, "\n")) != -1) {
         string message = StringSubstr(recv_buffer, 0, newline_pos);
         recv_buffer = StringSubstr(recv_buffer, newline_pos + 1);

         // Trim whitespace
         StringTrimLeft(message);
         StringTrimRight(message);
         if(StringLen(message) == 0) continue;

         Print("[TCP] Received Full Packet: ", message);

         // --- HEARTBEAT ---
         if(StringFind(message, "\"action\": \"HEARTBEAT\"") != -1 ||
            StringFind(message, "\"action\":\"HEARTBEAT\"") != -1) {
            Print("\xF0\x9F\x92\x97 [PYTHON PING] Heartbeat received.");
         }

         // --- POSITION SYNC REQUEST ---
         else if(StringFind(message, "\"action\": \"SYNC_POSITIONS\"") != -1 ||
                 StringFind(message, "\"action\":\"SYNC_POSITIONS\"") != -1) {
            SendPositionSync();
         }

         // --- CLOSE ALL BUY ---
         else if(StringFind(message, "CLOSE_ALL_BUY") != -1) {
            Print("\xF0\x9F\x94\xA5 [KILL SWITCH] Closing ALL BUY positions...");
            CloseAllPositions(POSITION_TYPE_BUY);
         }

         // --- CLOSE ALL SELL ---
         else if(StringFind(message, "CLOSE_ALL_SELL") != -1) {
            Print("\xF0\x9F\x94\xA5 [KILL SWITCH] Closing ALL SELL positions...");
            CloseAllPositions(POSITION_TYPE_SELL);
         }

         // --- EMERGENCY CLOSE ALL ---
         else if(StringFind(message, "SYNC_EMERGENCY_CLOSE") != -1) {
            Print("\xF0\x9F\x9A\xA8\xF0\x9F\x9A\xA8\xF0\x9F\x9A\xA8 [EMERGENCY] Closing ALL positions!");
            CloseAllPositions(POSITION_TYPE_BUY);
            CloseAllPositions(POSITION_TYPE_SELL);
         }

         // --- BUY ORDER (with SL/TP from JSON) ---
         else if(StringFind(message, "\"action\": \"BUY\"") != -1 ||
                 StringFind(message, "\"action\":\"BUY\"") != -1) {
            double ask = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
            double sl  = ParseJsonDouble(message, "sl");
            double tp  = ParseJsonDouble(message, "tp");

            // Enforce SL/TP floors (NEVER zero)
            if(sl == 0.0 || sl == ask) sl = ask - SL_FALLBACK;
            if(tp == 0.0 || tp == ask) tp = ask + TP_FALLBACK;

            // Respect broker's minimum stop level
            EnforceStopLevel(ask, sl, tp, "BUY");

            Print("\xF0\x9F\x9F\xA2 [ORDER] BUY @ ", ask, " | SL=", sl, " | TP=", tp);

            if(trade.Buy(LOT_SIZE, Symbol(), ask, sl, tp, "Python_Engine")) {
               ulong ticket = trade.ResultOrder();
               Print("\xE2\x9C\x85 [TRADE OPENED] BUY ticket #", ticket);
               EnforceSLTP(ticket, sl, tp);
               SendOrderFilled(ticket, "BUY");
            } else {
               int err = GetLastError();
               Print("\xE2\x9D\x8C [BUY FAILED] Error: ", err);
               SendOrderFailed("BUY", err, ask, sl, tp);
            }
         }

         // --- SELL ORDER (with SL/TP from JSON) ---
         else if(StringFind(message, "\"action\": \"SELL\"") != -1 ||
                 StringFind(message, "\"action\":\"SELL\"") != -1) {
            double bid = SymbolInfoDouble(Symbol(), SYMBOL_BID);
            double sl  = ParseJsonDouble(message, "sl");
            double tp  = ParseJsonDouble(message, "tp");

            // Enforce SL/TP floors (NEVER zero)
            if(sl == 0.0 || sl == bid) sl = bid + SL_FALLBACK;
            if(tp == 0.0 || tp == bid) tp = bid - TP_FALLBACK;

            // Respect broker's minimum stop level
            EnforceStopLevel(bid, sl, tp, "SELL");

            Print("\xF0\x9F\x9F\xA2 [ORDER] SELL @ ", bid, " | SL=", sl, " | TP=", tp);

            if(trade.Sell(LOT_SIZE, Symbol(), bid, sl, tp, "Python_Engine")) {
               ulong ticket = trade.ResultOrder();
               Print("\xE2\x9C\x85 [TRADE OPENED] SELL ticket #", ticket);
               EnforceSLTP(ticket, sl, tp);
               SendOrderFilled(ticket, "SELL");
            } else {
               int err = GetLastError();
               Print("\xE2\x9D\x8C [SELL FAILED] Error: ", err);
               SendOrderFailed("SELL", err, bid, sl, tp);
            }
         }

         else {
            Print("\xE2\x9A\xA0\xEF\xB8\x8F [UNKNOWN SIGNAL]: ", message);
         }
      }

      // Timeout: if buffer has stale partial data for > 500ms, clear it
      if(StringLen(recv_buffer) > 0 && (GetTickCount() - last_recv_time) > 500) {
         Print("\xE2\x9A\xA0\xEF\xB8\x8F [BUFFER TIMEOUT] Clearing stale partial data (", StringLen(recv_buffer), " chars): ", StringSubstr(recv_buffer, 0, 100));
         recv_buffer = "";
      }
   }
}

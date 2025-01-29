import os
import pandas as pd
import ccxt
from datetime import datetime

CACHE_DIR = "cache"

def fetch_binance_data(symbol, timeframe="1d", limit=500, realtime=False):
    symbol_dir = os.path.join(CACHE_DIR, symbol.replace("/", "_"))
    if not os.path.exists(symbol_dir):
        os.makedirs(symbol_dir)

    cache_file = os.path.join(symbol_dir, f"{timeframe}.csv")

    if not realtime:
        if os.path.exists(cache_file):
            cached_data = pd.read_csv(cache_file, parse_dates=['timestamp'])
            
            last_timestamp = cached_data['timestamp'].iloc[-1].to_pydatetime()
            current_date = datetime.utcnow()
            
            if last_timestamp.date() == current_date.date():
                if len(cached_data) >= limit:
                    return cached_data.iloc[-limit:]

    binance = ccxt.binance()
    ohlcv = binance.fetch_ohlcv(symbol, timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')

    if not realtime:
        df.to_csv(cache_file, index=False)

    return df

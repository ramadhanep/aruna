def calculate_ema(data, length):
    return data.ewm(span=length, adjust=False).mean()

def calculate_stochastic_rsi(data, length=14):
    min_val = data.rolling(window=length).min()
    max_val = data.rolling(window=length).max()
    stoch_rsi = (data - min_val) / (max_val - min_val)
    return stoch_rsi * 100

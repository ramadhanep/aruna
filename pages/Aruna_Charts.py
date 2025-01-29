import streamlit as st
import pandas as pd
import requests
import json
from utils.fetch_data import fetch_binance_data
from utils.indicators import calculate_ema, calculate_stochastic_rsi
from utils.charts import plot_candlestick_chart

MODEL_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3.2:1b"

def parse_streaming_response(raw_response):
    try:
        responses = []
        for line in raw_response.split("\n"):
            if line.strip():
                try:
                    json_obj = json.loads(line)
                    if "response" in json_obj:
                        responses.append(json_obj["response"])
                except json.JSONDecodeError:
                    continue
        return "".join(responses).strip()
    except Exception as e:
        return f"Error parsing streaming response: {e}"
        
def get_detail_explanation(signal, signal_detail, strategy):
    fallback_explanations = {
        "LASER EYE": "A significant breakout occurred where the price crossed both EMAs from below, signaling a potential bullish trend.",
        "OVERBOUGHT": "The asset appears to be overbought, suggesting it may be trading above its fair value.",
        "BULLISH MOMENTUM": "The price is showing strong upward momentum, supported by positive market sentiment.",
        "FOLLOW THE TREND": "No breakout has been detected, and the price is following a steady trend.",
        "OVERSOLD": "The asset seems to be oversold, trading below its typical value range.",
        "BEARISH MOMENTUM": "The price is displaying strong downward momentum, often driven by negative market sentiment.",
        "NO CLEAR SIGNAL": "The indicators do not point to any clear trend or breakout at the moment."
    }

    prompt = f"""
    Explain the following trading signal in detail using simple language, maximum 2 sentences, make sure you dont confirm about the question like Here's an explanation, just straight forward:
    Signal: {signal} - {signal_detail} - {fallback_explanations.get(signal_detail, 'No explanation available.')}
    """

    if strategy:
        prompt += f"""
        Strategy:
        Entry: ${strategy['entry_range'][0]:,.2f} - ${strategy['entry_range'][1]:,.2f}
        Stop Loss (SL): ${strategy['stop_loss']:,.2f}
        Target: ${strategy['target']:,.2f}
        Risk-to-Reward (RR): {strategy['risk_to_reward']}
        Always DYOR – Do Your Own Research before trading or investing.
        """

    try:
        payload = {
            "model": MODEL_NAME,
            "prompt": prompt,
            "history": []
        }
        response = requests.post(MODEL_URL, json=payload)
        response.raise_for_status()

        raw_response = response.text
        return parse_streaming_response(raw_response)
    except Exception as e:
        return f"Error retrieving explanation from AI: {e}. Fallback: {fallback_explanations.get(signal_detail, 'No explanation available.')}"


st.set_page_config(page_title="Aruna Chart", layout="wide",
    menu_items={
        'Get Help': None,
        'Report a bug': None,
        'About': None
    })

def load_coin_list(file_path):
    return pd.read_csv(file_path)

def determine_signal(data):
    last_close = data['close'].iloc[-1]  # Get the latest close price
    prev_close = data['close'].iloc[-2]  # Get the previous close price
    ema_13 = data['EMA_13'].iloc[-1]  # Get the latest EMA 13 value
    ema_21 = data['EMA_21'].iloc[-1]  # Get the latest EMA 21 value
    stoch_rsi = data['Stochastic_RSI'].iloc[-1]  # Get the latest Stochastic RSI value

    if last_close > ema_13 and last_close > ema_21:
        signal = "BUY"
        if stoch_rsi > 50:
            signal = "STRONG BUY"
        if last_close > max(ema_13, ema_21) and prev_close <= max(ema_13, ema_21):
            signal_detail = "LASER EYE"
            strategy = {
                "entry_range": (max(ema_13, ema_21), last_close),
                "stop_loss": ema_21 / 0.05,
                "target": last_close * 1.05,
                "risk_to_reward": "1:3"
            }
        elif stoch_rsi > 70:
            signal_detail = "OVERBOUGHT"
            strategy = None
        elif stoch_rsi > 50:
            signal_detail = "BULLISH MOMENTUM"
            strategy = None
        else:
            signal_detail = "FOLLOW THE TREND"
            strategy = None
    elif last_close < ema_13 and last_close < ema_21:
        signal = "SELL"
        if stoch_rsi < 50:
            signal = "STRONG SELL"
        signal_detail = "FOLLOW THE TREND"
        strategy = None
    else:
        signal = "NEUTRAL"
        if stoch_rsi > 70:
            signal_detail = "OVERBOUGHT"
            strategy = None
        elif stoch_rsi < 30:
            signal_detail = "OVERSOLD"
            strategy = None
        elif ema_13 > ema_21:
            signal_detail = "BULLISH MOMENTUM"
            strategy = None
        elif ema_13 < ema_21:
            signal_detail = "BEARISH MOMENTUM"
            strategy = None
        else:
            signal_detail = "NO CLEAR SIGNAL"
            strategy = None

    return signal, signal_detail, strategy

def main():

    st.sidebar.header("Config")

    realtime = st.sidebar.checkbox("Realtime Data", value=True)

    coins = load_coin_list("data/coins.csv")
    coin_name = st.sidebar.selectbox("Select Cryptocurrency", options=coins['name'])
    symbol = coins[coins['name'] == coin_name]['symbol'].values[0]

    timeframe = st.sidebar.selectbox("Select Timeframe", options=["1m", "5m", "1h", "4h", "1d", "1w", "1M"], index=4)  # Default to daily
    limit = st.sidebar.slider("Data Points", min_value=100, max_value=1000, value=100, step=100)  # Default to 100

    ema_short = 13
    ema_long = 21
    stoch_length = 14

    with st.spinner("Fetching data..."):
        data = fetch_binance_data(symbol, timeframe, limit, realtime=realtime)

    data['EMA_13'] = calculate_ema(data['close'], length=ema_short)
    data['EMA_21'] = calculate_ema(data['close'], length=ema_long)
    data['Stochastic_RSI'] = calculate_stochastic_rsi(data['close'], length=stoch_length)

    signal, signal_detail, strategy = determine_signal(data)
    
    with st.spinner("Aruna AI analyzing..."):
        description = get_detail_explanation(signal, signal_detail, strategy)

    candlestick_fig, stoch_rsi_fig = plot_candlestick_chart(
        data, data['EMA_13'], data['EMA_21'], data['Stochastic_RSI'], coin_name, f"{signal}", f"{signal_detail}", f"{description}"
    )
    st.plotly_chart(candlestick_fig, use_container_width=True)
    st.plotly_chart(stoch_rsi_fig, use_container_width=True)

if __name__ == "__main__":
    main()

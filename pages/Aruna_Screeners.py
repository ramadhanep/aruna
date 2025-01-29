import streamlit as st
import pandas as pd
from utils.fetch_data import fetch_binance_data
from utils.indicators import calculate_ema, calculate_stochastic_rsi

st.set_page_config(page_title="Aruna Screener", layout="wide")
st.markdown(
        r"""
        <style>
        .stAppToolbar {
                visibility: hidden;
            }
        </style>
        """, unsafe_allow_html=True
    )

EMA_SHORT = 13
EMA_LONG = 21
STOCH_LENGTH = 14

def determine_signal(data):
    last_close = data['close'].iloc[-1]
    ema_13 = data['EMA_13'].iloc[-1]
    ema_21 = data['EMA_21'].iloc[-1]
    stoch_rsi = data['Stochastic_RSI'].iloc[-1]

    if last_close > ema_13 and last_close > ema_21:
        signal = "🟢BUY"
        if stoch_rsi > 50:
            signal = "🟢🟢STRONG BUY"
    elif last_close < ema_13 and last_close < ema_21:
        signal = "🔴SELL"
        if stoch_rsi < 50:
            signal = "🔴🔴STRONG SELL"
    else:
        signal = "🔵NEUTRAL"

    return signal

def main():
    st.markdown(
        """
        <h1 style="font-family: sans-serif; text-align: center; margin-bottom: 20px;">
            Aruna Screener
        </h1>
        """,
        unsafe_allow_html=True,
    )

    coins = pd.read_csv("data/coins.csv")

    timeframe = st.sidebar.selectbox("Select Timeframe", options=["1m", "5m", "1h", "1d", "1w", "1M"], index=3)  # Default daily
    limit = st.sidebar.slider("Data Points", min_value=100, max_value=1000, value=200, step=100)  # Default 200

    realtime = st.sidebar.checkbox("Realtime Data", value=True)

    if "loaded_coins" not in st.session_state:
        st.session_state["loaded_coins"] = 10

    st.info("Fetching data and calculating signals. This may take a while...")

    results = []
    for _, row in coins.head(st.session_state["loaded_coins"]).iterrows():
        symbol = row['symbol']
        name = row['name']

        try:
            data = fetch_binance_data(symbol, timeframe, limit, realtime=realtime)
            data['EMA_13'] = calculate_ema(data['close'], length=EMA_SHORT)
            data['EMA_21'] = calculate_ema(data['close'], length=EMA_LONG)
            data['Stochastic_RSI'] = calculate_stochastic_rsi(data['close'], length=STOCH_LENGTH)

            signal = determine_signal(data)
            results.append({"Name": name, "Symbol": symbol, "Signal": signal})
        except Exception as e:
            results.append({"Name": name, "Symbol": symbol, "Signal": f"Error: {e}"})

    results_df = pd.DataFrame(results)

    st.markdown("## Screening Results")
    st.dataframe(results_df, use_container_width=True)

    if st.button("Load More Coins"):
        st.session_state["loaded_coins"] += 5
        st.experimental_rerun()

if __name__ == "__main__":
    main()

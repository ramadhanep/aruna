import plotly.graph_objects as go
import streamlit as st

def plot_candlestick_chart(data, ema_13, ema_21, stoch_rsi, symbol, signal, signal_detail, description):
    last_close = data['close'].iloc[-1]

    signal_styles = {
        "BUY": {"color": "darkgreen"},
        "STRONG BUY": {"color": "darkgreen"},
        "SELL": {"color": "darkred"},
        "STRONG SELL": {"color": "darkred"},
        "NEUTRAL": {"color": "darkblue"},
    }

    badge_style = signal_styles.get(signal, {"color": "yellow"})
    badge_html = f"""
    <span style='background-color:{badge_style["color"]}; color:white; padding-left: 5px;'>
        {signal}: {signal_detail}
    </span>
    """

    fig = go.Figure(
        data=[
            go.Candlestick(
                x=data['timestamp'],
                open=data['open'],
                high=data['high'],
                low=data['low'],
                close=data['close'],
                name="Candlestick"
            ),
            go.Scatter(
                x=data['timestamp'],
                y=ema_13,
                mode='lines',
                line=dict(color='orange', width=2),
                name="EMA 13"
            ),
            go.Scatter(
                x=data['timestamp'],
                y=ema_21,
                mode='lines',
                line=dict(color='white', width=2),
                name="EMA 21"
            )
        ]
    )
    fig.update_layout(
        xaxis_title="Time",
        yaxis_title="Price",
        template="plotly_dark",
        height=700,
        showlegend=False
    )

    st.markdown(
        f"""
        <div style="padding: 5px;">
            <h3 style="color: white; font-family: sans-serif;">{symbol}</h3>
            <span style="color: white; font-family: monospace; font-size: 32px; font-weight: bold;">
                ${"{:,.2f}".format(last_close)}
            </span><br><br>
            <span style="color: white; font-family: sans-serif; font-size: 24px; font-weight: bold;">{badge_html}</span>
            <br><br><div style="color: #afee00; font-family: monospace;">
                {description}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    stoch_rsi_fig = go.Figure(
        data=[
            go.Scatter(
                x=data['timestamp'],
                y=stoch_rsi,
                mode='lines',
                line=dict(color='orange', width=2),
                name="Stochastic RSI"
            )
        ]
    )
    stoch_rsi_fig.add_hline(y=80, line_dash="dash", line_color="red", annotation_text="Overbought")
    stoch_rsi_fig.add_hline(y=20, line_dash="dash", line_color="green", annotation_text="Oversold")
    stoch_rsi_fig.update_layout(
        xaxis_title="Time",
        yaxis_title="Stochastic RSI (%)",
        template="plotly_dark",
        height=300
    )

    return fig, stoch_rsi_fig


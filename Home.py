import streamlit as st

st.set_page_config(page_title="Aruna", layout="wide",
    menu_items={
        'Get Help': None,
        'Report a bug': None,
        'About': None
    })

def main():
    st.markdown(
        """
        <style>
            .container {
                max-width: 900px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                font-size: 36px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 20px;
            }
            .description {
                font-size: 18px;
                line-height: 1.6;
                text-align: center;
                margin-bottom: 30px;
            }
            .features {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                margin-top: 40px;
            }
            .feature-card {
                flex: 1 1 calc(33.333% - 20px);
                background-color: #090909;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                margin: 10px;
                text-align: center;
                transition: all 0.3s ease-in-out;
                cursor: pointer;
                text-decoration: none;
                color: white;
            }
            .feature-title {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 10px;
                text-decoration: none;
                color: white;
            }
            .feature-description {
                font-size: 16px;
                text-decoration: none;
                color: white;
            }
            .feature-card:hover {
                background-color: #f1f1f1;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            .feature-card:hover .feature-title,
            .feature-card:hover .feature-description {
                color: #000000;
            }
            .feature-link {C
            }
        </style>
        """,
        unsafe_allow_html=True,
    )

    st.markdown('<div class="container">', unsafe_allow_html=True)
    st.markdown('<div class="header">Welcome to Aruna</div>', unsafe_allow_html=True)
    st.markdown(
        """
        <div class="description">
            Explore cutting-edge tools for traders and investors, designed to empower your decision-making.
            Aruna combines advanced AI with robust analytics to provide actionable insights, making your 
            trading journey more efficient and successful.
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown('<div class="features">', unsafe_allow_html=True)
    features = [
        {"title": "Aruna AI", "description": "Leverage powerful AI for market analysis with precision.", "link": "Aruna_AI"},
        {"title": "Aruna Charts", "description": "Analyze candlestick patterns with integrated EMA and Stochastic RSI indicators.", "link": "Aruna_Charts"},
        {"title": "Aruna Screeners", "description": "Screen and filter cryptocurrencies based on technical signals and parameters.", "link": "Aruna_Screeners"},
    ]

    for feature in features:
        st.markdown(
            f"""
            <a href="{feature['link']}" target="_self" class="feature-link">
                <div class="feature-card">
                    <div class="feature-title">{feature['title']}</div>
                    <div class="feature-description">{feature['description']}</div>
                </div>
            </a>
            """,
            unsafe_allow_html=True,
        )
    st.markdown('</div>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

if __name__ == "__main__":
    main()

# Aruna

Aruna is a cutting-edge tool for traders and investors, combining advanced AI with robust analytics to provide actionable insights. With features like AI-driven market analysis, candlestick charts with technical indicators, and a cryptocurrency screener, Aruna empowers your financial decision-making.

## Features
- **Aruna AI**: Leverage powerful AI for market analysis with precision.
- **Aruna Charts**: Analyze candlestick patterns with integrated EMA and Stochastic RSI indicators.
- **Aruna Screeners**: Screen and filter cryptocurrencies based on technical signals and parameters.

## Installation
### Option 1: Run Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/ramadhanep/aruna.git
   cd aruna
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the app:
   ```bash
   streamlit run Home.py
   ```

### Option 2: Run with Docker
1. Build and run the Docker container using the provided script:
   - **Windows**:
     ```
     run_docker.bat
     ```
   - **Linux/Mac**:
     ```bash
     ./run_docker.sh
     ```

2. Access the app in your browser at:
   ```
   http://localhost:8501
   ```

## Project Structure
```
aruna/
├── Home.py                  # Main landing page
├── pages/
│   └── Aruna_AI.py          # Aruna AI page
│   └── Aruna_Charts.py      # Aruna Charts page
│   └── Aruna_Screeners.py   # Aruna Screeners page
├── data/
│   └── coins.csv            # Cryptocurrency list
├── utils/
│   ├── fetch_data.py        # Binance data fetching logic
│   ├── indicators.py        # Technical indicators calculations
│   └── charts.py            # Plotly charts for candlestick and indicators
├── requirements.txt         # Dependencies
├── run_docker.bat           # Windows Docker script
├── run_docker.sh            # Linux/Mac Docker script
└── README.md                # Project documentation
```

## Dependencies
- **Streamlit**: Frontend framework for building interactive web apps.
- **Plotly**: Visualization library for candlestick and Stochastic RSI charts.
- **ccxt**: Library for cryptocurrency data from Binance.
- **Pandas**: Data manipulation and analysis.

## Requirements
- Python 3.7 or higher
- A modern web browser
- Internet connection (for fetching live data from Binance)

## License
This project is licensed under the GNU General Public License.

## Author
Developed by [Ramadhan Edy](https://github.com/ramadhanep).
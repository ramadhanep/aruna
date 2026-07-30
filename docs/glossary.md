# Glossary

| Term | Definition |
|---|---|
| **Aruna** | Project name. Sanskrit-derived word meaning "dawn" or "red sky". |
| **IDX** | Indonesia Stock Exchange (Bursa Efek Indonesia). |
| **JK** | Suffix for stocks listed on the Indonesia Stock Exchange (e.g., `BBCA.JK`). |
| **RRG** | Relative Rotation Graph — a visualization showing stock/sector rotation through four quadrants: Leading, Weakening, Lagging, Improving. |
| **EMA-31** | 31-period Exponential Moving Average used as the momentum indicator in the screener. |
| **MSCI** | Morgan Stanley Capital International — provides stock market indexes. MSCI Standard ($2B+ free-float market cap) and Small Cap ($300M+) are tracked. |
| **Money Flow** | Institutional buying/selling pressure derived from broker transaction data. |
| **Accumulation** | Net buying by institutions (bullish signal). |
| **Distribution** | Net selling by institutions (bearish signal). |
| **Accdist** | Accumulation/Distribution — a metric indicating whether a stock is being accumulated or distributed. |
| **OHLCV** | Open, High, Low, Close, Volume — standard price data format. |
| **Free-Float Market Cap** | Market capitalization calculated only from publicly traded shares (excludes locked-in shares by founders/government). |
| **Supercharts** | The chart analysis page combining seasonal patterns, candlestick charts, fundamentals, and analyst ratings. |
| **PWA** | Progressive Web App — a web application that can be installed on a device and work offline. |
| **XOR Payload** | The response encoding scheme where JSON is serialized, XOR-encrypted with a key, base64-encoded, and wrapped in `{ payload: "..." }`. |
| **Stockbit** | Indonesian social investment platform. Aruna uses Stockbit's private API for broker transaction data. |
| **Ajaib** | Indonesian stock trading app. Source for IDX stock bubble map data. |
| **Bibit** | Indonesian robo-advisor investment app. Alternative IDX stock data source. |
| **Pluang** | Indonesian multi-asset investment platform. Source for US stock logo SVGs. |
| **Vanta.js** | JavaScript library for animated 3D website backgrounds (used on old landing page, since removed — see commit "add landing image and enhance landing page with Vanta.js background" for history). |
| **Butter-Smooth** | A code comment pattern emphasizing smooth scrolling performance (`src/components/mobile-bottom-nav.jsx:71`, re: passive scroll listener for iOS). |
| **shadcn/ui** | Collection of re-usable React components built with Radix UI and Tailwind CSS. Components are copied into the project, not installed as a package. |
| **Trial Guard** | A `TrialGuard` wrapper component that blocks content access when the user's trial has expired. |

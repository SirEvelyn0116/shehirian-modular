# Payment Integration Prototype

A Next.js checkout flow prototype demonstrating two fulfillment options with Clover POS integration.

## Features

### Fulfillment Options
1. **Shopify Shipping (FBM)** - Ship from Store
   - Mock discounted carrier rates (Canada Post, UPS)
   - Multiple shipping speed options
   - Real-time rate calculation
   - Fake tracking number generation

2. **Amazon FBA** - Fulfilled by Amazon
   - Prime delivery with FREE shipping
   - 1-2 day delivery speed
   - Amazon-branded fulfillment
   - Mock Amazon tracking

### Clover Integration
- Sends orders to Clover sandbox API
- Synchronizes inventory
- POS reporting integration
- Structured for easy production deployment

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **APIs**: 
  - Clover Sandbox REST API
  - Mock Shopify Shipping
  - Mock Amazon FBA

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm

### Installation

1. Clone the repository or use the current directory

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit [.env](.env) and add your Clover sandbox credentials:
```
CLOVER_API_KEY=your_clover_api_key_here
CLOVER_MERCHANT_ID=your_merchant_id_here
CLOVER_DEVICE_ID=your_device_id_here
```

> **Note**: The app will work in mock mode without Clover credentials, but won't sync with actual POS.

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
.
├── app/
│   ├── page.tsx              # Home page with product listing
│   ├── product/              # Product details page
│   ├── checkout/             # Checkout with fulfillment toggle
│   ├── confirmation/         # Order confirmation
│   ├── api/
│   │   └── orders/           # Order API endpoints
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── lib/
│   ├── clover.ts             # Clover API service
│   ├── shopify-shipping.ts   # Shopify Shipping mock
│   └── amazon-fba.ts         # Amazon FBA mock
└── .env.example              # Environment variables template
```

## User Flow

1. **Home** → Browse products
2. **Product Page** → View details, select quantity
3. **Checkout** → Choose fulfillment option:
   - **Shopify Shipping**: Select carrier and service level
   - **Amazon FBA**: Automatic Prime delivery
4. **Order Confirmation** → View order details, tracking number, delivery estimate

## API Integration

### Clover Sandbox

The Clover service ([lib/clover.ts](lib/clover.ts)) integrates with Clover's sandbox API to:
- Create orders in POS system
- Update inventory levels
- Sync order data for reporting

**To enable real Clover integration:**
1. Get API credentials from [Clover Sandbox](https://sandbox.dev.clover.com)
2. Add credentials to [.env](.env)
3. Uncomment API call code in [lib/clover.ts](lib/clover.ts)

### Shopify Shipping

Mock implementation in [lib/shopify-shipping.ts](lib/shopify-shipping.ts) simulates:
- Rate shopping across carriers
- Label generation
- Tracking number creation

**To enable real Shopify Shipping:**
1. Install Shopify app and get API token
2. Replace mock functions with actual Shopify API calls
3. Update rate fetching logic with real API endpoints

### Amazon FBA

Mock implementation in [lib/amazon-fba.ts](lib/amazon-fba.ts) simulates:
- FBA order creation
- Prime delivery
- Amazon tracking

**To enable real Amazon FBA:**
1. Set up Amazon MWS/SP-API credentials
2. Replace mock functions with actual API calls
3. Implement proper SKU mapping

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### VS Code Tasks

A task is configured to run the dev server. Access via:
- Command Palette: `Tasks: Run Task` → `dev`
- Terminal menu: `Terminal` → `Run Task` → `dev`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CLOVER_API_KEY` | Clover sandbox API key | No* |
| `CLOVER_MERCHANT_ID` | Clover merchant ID | No* |
| `CLOVER_DEVICE_ID` | Clover device ID | No* |

*App will run in mock mode without these credentials

## Production Deployment

### Before Going Live

1. **Replace mock services** with real API integrations
2. **Add database** for order persistence (currently in-memory)
3. **Implement authentication** and user accounts
4. **Add payment processing** (Stripe, PayPal, etc.)
5. **Set up proper error handling** and logging
6. **Configure production environment variables**
7. **Test API integrations** thoroughly

### Recommended Additions

- Database (PostgreSQL, MongoDB)
- Authentication (NextAuth.js)
- Payment gateway integration
- Email notifications
- Admin dashboard
- Analytics tracking
- Error monitoring (Sentry)

## Notes

- This is a **prototype** for demonstration purposes
- Mock data is stored in memory (resets on server restart)
- Real API calls are commented out but structured for easy implementation
- All tracking numbers and delivery dates are simulated

## Support

For issues or questions about:
- **Clover API**: [Clover Developer Docs](https://docs.clover.com/)
- **Shopify Shipping**: [Shopify API Docs](https://shopify.dev/api/admin-rest)
- **Amazon FBA**: [Amazon SP-API Docs](https://developer-docs.amazon.com/sp-api/)

## License

MIT

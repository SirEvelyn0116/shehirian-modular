# Payment Integration Prototype - Project Guidelines

## Project Overview
Next.js checkout flow prototype with two fulfillment options:
1. Shopify Shipping (FBM) - Ship from Store
2. Amazon FBA - Fulfilled by Amazon

Integrates with Clover sandbox API for POS order management.

## Setup Complete ✓
- [x] Create copilot-instructions.md file
- [x] Scaffold Next.js project
- [x] Customize project structure
- [x] Install dependencies
- [x] Create and run dev task
- [x] Update documentation

## Technical Stack
- Next.js 14+ with App Router
- TypeScript
- Tailwind CSS
- Clover Sandbox REST API
- Mock Shopify Shipping & Amazon FBA integrations

## Project Structure
```
app/
├── page.tsx                    # Home page
├── product/page.tsx            # Product details
├── checkout/page.tsx           # Checkout with fulfillment options
├── confirmation/page.tsx       # Order confirmation
└── api/orders/                 # Order API routes

lib/
├── clover.ts                   # Clover API integration
├── shopify-shipping.ts         # Shopify Shipping mock
└── amazon-fba.ts               # Amazon FBA mock
```

## Development
Run `npm run dev` or use the VS Code task to start the development server at http://localhost:3000

## Key Features
- Toggle between Shopify Shipping and Amazon FBA at checkout
- Mock shipping rates and tracking numbers
- Clover POS integration (works in mock mode without credentials)
- Structured for easy real API integration

See README.md for full documentation.

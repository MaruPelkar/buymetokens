# BuyMeTokens

A platform where users can donate USD to developers via Stripe, and developers can spend those funds through OpenRouter to access any AI model.

## Features

- GitHub OAuth authentication
- Customizable developer showcase pages
- Stripe payment integration
- OpenRouter API proxy for AI model access
- Real-time balance management
- Transaction history and analytics

## Tech Stack

- **Framework**: Next.js 15 with TypeScript (App Router)
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: GitHub OAuth
- **Payments**: Stripe + Stripe Connect
- **AI**: OpenAI (profile generation) + OpenRouter (user spending)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase account recommended)
- GitHub OAuth App
- Stripe account
- OpenRouter API key
- OpenAI API key

### Environment Setup

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Fill in all required environment variables in `.env.local`

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Setup

Run the schema SQL in your PostgreSQL database:
```bash
psql $DATABASE_URL < src/lib/db/schema.sql
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── (public)/          # Public profile pages
│   ├── api/               # API routes
│   └── page.tsx           # Landing page
├── components/            # React components
├── lib/                   # Utility functions and integrations
└── types/                 # TypeScript type definitions
```

## Architecture

### Payment Flow
```
Donor → Stripe Payment → Platform (5% fee) → Developer Balance → OpenRouter Usage
```

### Key Features

1. **Authentication**: GitHub OAuth for seamless developer onboarding
2. **Profiles**: Auto-generated showcase pages with GitHub repos and contributions
3. **Donations**: Stripe-powered payment system with customizable amounts
4. **AI Credits**: OpenRouter proxy that deducts from developer balance
5. **Dashboard**: Real-time balance tracking and transaction history

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

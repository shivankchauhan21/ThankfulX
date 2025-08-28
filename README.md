# Thank You Scribe API

AI-powered thank you message generation API for customer appreciation.

## Features

- **AI Message Generation**: Generate personalized thank you messages using Google Gemini AI and OpenAI
- **Credit System**: Pay-per-use model with free trial
- **File Upload**: Process Excel/CSV files with customer data
- **Authentication**: JWT-based user authentication
- **Organization Support**: Multi-tenant architecture
- **Rate Limiting**: 50 messages per day per user limit

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Google Gemini AI API key
- OpenAI API key (optional)

## Setup

1. **Clone and install dependencies:**
   ```bash
   cd thank-you-scribe-api
   npm install
   ```

2. **Environment Configuration:**
   ```bash
   cp env.example .env
   # Edit .env with your actual values
   ```

3. **Database Setup:**
   ```bash
   # Create PostgreSQL database
   createdb thank_you_scribe_db
   
   # Run migrations
   npx prisma migrate dev
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `GOOGLE_API_KEY` | Google Gemini AI API key | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Optional |
| `PORT` | Server port | No (default: 5000) |
| `FRONTEND_URL` | Frontend URL for CORS | No (default: localhost:8080) |

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/purchase-credits` - Purchase credits

### File Upload
- `POST /api/upload` - Upload customer data file (CSV, Excel)

### Message Generation
- `POST /api/messages/generate` - Generate thank you messages

## Credit System

Credits are calculated based on:
- **Message Length**: Short (1x), Medium (1.5x), Long (2x)
- **Style**: Casual (1x), Friendly (1.2x), Formal (1.3x), Professional (1.4x)
- **Language**: English (1x), Other languages (1.5x)
- **Creativity**: Low (1x), Medium (1.2x), High (1.5x)
- **Products**: With products (1.2x), Without products (1x)

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## File Format Requirements

Upload files must contain:
- **Customer Name** (required): Column header must be exactly "Customer Name"
- **Product Description** (optional): Column header must be exactly "Product Description"

Supported formats: CSV, XLSX, XLS, ODS

## Security Features

- JWT authentication with httpOnly cookies
- Password hashing with bcrypt
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Helmet security headers
- Input validation with Zod
- SQL injection protection via Prisma ORM

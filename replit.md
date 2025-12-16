# Afrolandx - Nigerian Fashion E-commerce Platform

## Overview

Afrolandx is a full-stack e-commerce platform specializing in authentic Nigerian fashion. The application connects vendors selling traditional Nigerian clothing and accessories with customers worldwide. Built with a modern tech stack, it features vendor management, product listings, shopping cart functionality, order processing, integrated payment processing through Paystack, and a comprehensive measurements system for custom tailoring.

The platform supports three user roles (customers, vendors, and administrators) with role-based access control, enabling vendors to manage their products and customer measurements, administrators to oversee the marketplace, and customers to browse, purchase authentic Nigerian fashion items, and submit body measurements for custom-fitted clothing.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### December 16, 2025 - Discover Africa (Location-Based Services)
- Expanded "Discover Nigeria" to "Discover Africa" supporting all 54 African countries
- Country selector dropdown organized by region (Northern, Western, Central, Eastern, Southern Africa)
- Each country has major cities pre-configured (e.g., Nigeria: Lagos, Abuja; Kenya: Nairobi, Mombasa; South Africa: Johannesburg, Cape Town)
- Search for hotels, malls, restaurants, tourist attractions, airports, car rentals, cafes, and nightlife
- "Near Me" feature uses browser geolocation to find places nearby
- Place details modal shows ratings, reviews, contact info, opening hours, and photos
- Direct integration with Google Maps for navigation
- Server-side caching (10-minute TTL) to reduce API costs
- Backend proxy endpoints secure the API key (no client-side exposure)
- Located at /discover page
- Config data in shared/africaLocations.ts

### December 16, 2025 - 9 Advanced Features Implementation

**Feature 1: Bespoke Lookbook Studio**
- AI-powered outfit recommendations based on occasion type
- Users can specify event type (wedding, naming ceremony, festival, etc.), budget, and style notes
- AI stylist generates personalized outfit bundles from available products
- Lookbooks can be saved and accepted for future reference
- Located at /lookbook page

**Feature 2: Smart Fit Confidence Score**
- Personalized fit score displayed on products based on user measurements and community feedback
- FitScoreBadge component shows 70-100% fit confidence
- Order feedback system collects fit ratings and alteration data
- Integrates with loyalty points (50 pts for reviews)

**Feature 3: Measurement Health Alerts**
- Vendor dashboard shows alerts when customer measurements change significantly
- Delta summary shows which measurements changed and by how much
- Vendors can acknowledge alerts to dismiss them
- Helps vendors adjust orders in production

**Feature 4: Vendor Workshop Dashboard**
- Production stage tracking for custom orders (fabric cutting, sewing, embroidery, finishing, quality check, packaging)
- Material inventory management with low stock alerts
- Order timeline view showing production progress
- Located at /vendor/workshop page

**Feature 5: Event Outfit Planner**
- Browse outfit collections curated for specific Nigerian events
- Filter by event type, budget, and family size
- Shows fit compatibility score when user has measurements
- Calculates collection total and average fit score
- Located at /events page

**Feature 6: Cultural Story Capsules**
- Product stories with video, audio, or text about cultural heritage
- Shows region of origin, craft technique, and cultural context
- Vendors can add stories to their products
- Displayed on product detail pages

**Feature 7: Loyalty & Rewards Program**
- Points system: earn points for purchases, reviews, referrals, and quizzes
- Tiered membership: Bronze, Silver, Gold, Platinum with escalating benefits
- Referral codes: invite friends for bonus points
- Redeem points for discounts (100 pts = ₦500)
- Located at /loyalty page

**Feature 7b: Cultural Quizzes**
- Learn about Nigerian heritage through interactive quizzes
- Earn loyalty points for passing quizzes (70% threshold)
- Review answers with explanations
- Located at /quizzes/:id pages

**Feature 8: Live Fabric Viewer (Fabric Assets)**
- Support for high-resolution fabric texture images
- Can upload multiple fabric angles/views per product
- Foundation for future AR/3D preview features

**Feature 9: Designer Collaboration Hub**
- Limited edition drops featuring designer-artisan collaborations
- RSVP system with capacity limits
- Exclusive drops for higher loyalty tiers
- Countdown timers for upcoming drops
- Located at /collab-drops page

### October 25, 2025 - Cultural Heritage Carousel
- Added auto-rotating carousel to home page hero section showcasing Nigerian cultural heritage
- 7 authentic images of traditional objects: tribal masks, beadwork/jewelry, pottery/calabash, and kente/ankara fabrics
- Features only cultural artifacts and objects - no people
- Carousel auto-rotates every 5 seconds with smooth transitions
- Manual navigation via indicator dots at bottom
- Implemented on both landing page (non-authenticated) and home page (authenticated users)
- Uses embla-carousel-react for smooth performance

### October 25, 2025 - AI Body Scanning Integration
- Integrated 3DLOOK body scanning API for automated measurement capture
- "Scan My Body" button on measurement form initiates AI-powered body scanning
- Demo mode available for testing without API key (simulates full scanning flow)
- Production mode uses 3DLOOK Mobile Tailor API when DLOOK_API_KEY provided
- Privacy-focused: photos processed by AI and deleted immediately, only measurements stored
- Scan process: initiate → phone camera redirect → 2 photos → AI processing (45-60s) → auto-fill form
- Supports 10 body measurements: chest, waist, hips, height, shoulder width, sleeve length, arm length, inseam, outseam, neck
- Measurements schema updated to track scan method and session metadata
- Polling mechanism for scan results with timeout handling
- Full error handling with fallback to manual entry

### October 25, 2025 - Vendor-Customer Messaging System
- Added direct messaging system for vendor-customer communication
- Customers can send messages to vendors about products
- Vendors can reply to customer inquiries
- Real-time conversation view with message threading
- Unread message count displayed in navbar with automatic updates
- Notification system alerts users of new messages
- Full message history preserved for each conversation
- Accessible at /messages page

### October 25, 2025 - AI Chatbot Implementation
- Added AI-powered customer support chatbot using Replit AI Integrations (OpenAI gpt-5-mini)
- Chatbot provides help with product recommendations, measurement guidance, orders, and Nigerian fashion questions
- Floating chat button appears on all pages with clean, accessible UI
- Multi-turn conversation support with context retention within sessions
- Secure endpoint with Zod validation to prevent message injection attacks
- No API key required - uses Replit AI Integrations (charges billed to Replit credits)

### October 25, 2025 - Measurements Feature Implementation
- Added comprehensive measurements system for custom tailoring
- Customers can submit body measurements (chest, waist, hips, height, shoulder width, sleeve length, arm length, inseam, outseam, neck) to vendors
- Support for both metric (cm) and imperial (inches) measurement units
- Customers can manage their measurements through dedicated /measurements page
- Vendors can view and acknowledge customer measurements in their dashboard
- Notification system alerts vendors when measurements are submitted and customers when acknowledged
- Full CRUD operations with proper authentication and authorization
- Measurements can be optionally linked to specific orders, products, or vendors

## System Architecture

### Frontend Architecture

**Framework & Styling:**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server
- Tailwind CSS for utility-first styling with custom Nigerian-themed color palette (green, gold, coral)
- Shadcn UI component library (New York style variant) for consistent, accessible UI components
- Wouter for lightweight client-side routing

**State Management:**
- TanStack Query (React Query) for server state management with optimistic updates
- Context API for cart state management with persistent state
- Custom hooks for auth, cart, and toast notifications

**Key Design Patterns:**
- Component composition with Radix UI primitives
- Custom hook abstraction for business logic
- Optimistic updates for improved perceived performance
- Centralized API request handling with authentication

**Architectural Decisions:**
- Chose Wouter over React Router for smaller bundle size while maintaining necessary routing features
- Implemented optimistic updates in cart operations to improve user experience
- Used TanStack Query's built-in caching to minimize API calls
- Separated concerns with custom hooks (useAuth, useCart) for reusable logic

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript for type-safe API development
- Session-based authentication using Replit Auth (OpenID Connect)
- PostgreSQL session store for persistent authentication
- Role-based access control middleware (isAuthenticated, isAdmin)

**API Structure:**
- RESTful API endpoints organized by domain (products, vendors, orders, cart, etc.)
- Multer for multipart/form-data handling (image uploads)
- Request/response logging middleware for debugging
- Standardized error handling with appropriate HTTP status codes

**Key Design Patterns:**
- Middleware chain pattern for authentication and authorization
- Repository pattern through storage abstraction layer
- Service layer pattern for business logic (Paystack, Cloud Storage)
- Dependency injection for external services

**Architectural Decisions:**
- Chose session-based auth over JWT for simpler implementation with Replit Auth
- Implemented storage abstraction layer to decouple business logic from database operations
- Separated payment logic into dedicated service for easier testing and maintenance
- Used middleware pattern for cross-cutting concerns (auth, logging)

### Data Storage

**Database:**
- PostgreSQL with Neon serverless driver for scalable database connections
- Drizzle ORM for type-safe database operations
- WebSocket-based connection pooling for serverless compatibility

**Schema Design:**
- Users table integrated with Replit Auth (OIDC subject as primary key)
- Multi-role support via JSONB roles field (customer, vendor, admin)
- Vendors table with approval workflow (pending, approved, suspended)
- Products table with vendor relationship and approval status
- Orders and order items with normalized structure
- Cart items with user-product relationship
- Notifications table for user alerts
- Sessions table for Express session storage
- Measurements table for custom tailoring with comprehensive body measurements

**Key Design Decisions:**
- Used JSONB for flexible role arrays to support multi-role users
- Normalized order structure with separate order_items table for flexibility
- Vendor approval workflow to maintain marketplace quality
- Product approval system for content moderation
- WebSocket connections for Neon serverless compatibility

### Authentication & Authorization

**Authentication Provider:**
- Replit Auth using OpenID Connect (OIDC) protocol
- Passport.js strategy for standardized authentication flow
- Session-based authentication with PostgreSQL session store
- Automatic user creation/update on authentication

**Authorization System:**
- Multi-role system supporting customer, vendor, and admin roles
- Role-based middleware (isAuthenticated, isAdmin) for route protection
- Client-side role utilities for conditional rendering
- Session-based role persistence

**Key Design Decisions:**
- Chose Replit Auth for seamless integration with Replit deployment environment
- Implemented multi-role support to allow users to be both customers and vendors
- Used middleware pattern for authorization to keep route handlers clean
- Stored roles in JSONB for flexibility in role management

### External Dependencies

**Payment Processing:**
- Paystack integration for Nigerian payment processing
- Transaction initialization and verification endpoints
- Webhook support for payment status updates
- Reference-based transaction tracking

**Cloud Storage:**
- AWS S3-compatible storage for product images
- Sharp for image optimization and resizing
- Presigned URL generation for secure uploads
- Fallback to local storage when cloud storage unavailable

**Email Service:**
- SendGrid integration for transactional emails
- Order confirmation notifications
- Vendor approval notifications

**Key Integrations:**
- Paystack chosen as primary payment gateway for Nigerian market focus
- S3-compatible storage for scalable image hosting with local fallback
- SendGrid for reliable email delivery with template support
- Sharp for server-side image optimization to reduce bandwidth

**Configuration:**
- Environment-based service initialization
- Graceful degradation when services unavailable
- Centralized service management with initialization functions
- Feature flags for optional integrations (cloud storage, payments)
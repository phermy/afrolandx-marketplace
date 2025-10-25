# Afrolandx - Nigerian Fashion E-commerce Platform

## Overview

Afrolandx is a full-stack e-commerce platform specializing in authentic Nigerian fashion. The application connects vendors selling traditional Nigerian clothing and accessories with customers worldwide. Built with a modern tech stack, it features vendor management, product listings, shopping cart functionality, order processing, integrated payment processing through Paystack, and a comprehensive measurements system for custom tailoring.

The platform supports three user roles (customers, vendors, and administrators) with role-based access control, enabling vendors to manage their products and customer measurements, administrators to oversee the marketplace, and customers to browse, purchase authentic Nigerian fashion items, and submit body measurements for custom-fitted clothing.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

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
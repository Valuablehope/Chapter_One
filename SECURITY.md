# Security Documentation

## CSRF Protection

### Electron Application Context

This POS system is deployed as an **Electron desktop application**, which provides inherent CSRF (Cross-Site Request Forgery) protection through its architecture:

1. **Same-Origin Policy**: Electron applications run in a controlled environment where all requests originate from the same origin (the local Electron application). This prevents cross-site attacks.

2. **No Browser-Based Access**: The application is not accessed through a web browser where malicious websites could initiate requests. All API calls are made directly from the Electron renderer process.

3. **Controlled Network Access**: The application only communicates with the configured backend API, not arbitrary external websites.

### Current Implementation

- **CSRF Middleware**: The `csurf` package is included in dependencies but is **not currently applied** to routes because:
  - Electron's same-origin policy provides sufficient protection
  - Adding CSRF tokens would require additional complexity without security benefit in this context

### Future Considerations

If web-based access is added in the future (e.g., a web admin panel), CSRF protection should be implemented:

1. Enable CSRF middleware for web routes
2. Generate and validate CSRF tokens
3. Include tokens in forms and AJAX requests

### Best Practices

- **Never expose the backend API directly to the internet** without proper authentication
- **Use HTTPS** for all API communications in production
- **Implement rate limiting** (already implemented for auth endpoints)
- **Validate all inputs** (already implemented via express-validator)
- **Sanitize outputs** (already implemented via sanitizeMiddleware)

## JWT Security

### Token Storage

- **Current**: JWT tokens are stored in `localStorage` (via Zustand persist middleware)
- **Risk**: Vulnerable to XSS attacks if XSS vulnerabilities exist
- **Mitigation**: 
  - Electron's same-origin policy reduces XSS risk
  - All user inputs are sanitized
  - Content Security Policy (CSP) should be considered for additional protection

### Token Refresh

- Tokens automatically refresh every 12 hours to support long-running sessions
- Refresh endpoint requires valid authentication
- Failed refresh attempts do not immediately log out users (they will be logged out on next 401)

### Production Requirements

- **JWT_SECRET** must be set in production (minimum 32 characters)
- Application will fail to start if JWT_SECRET is missing or too short in production
- Use a cryptographically secure random string for JWT_SECRET

## Database Security

### Connection Security

- Database credentials are stored in environment variables (`.env` file)
- `.env` file should never be committed to version control
- Use strong passwords for database users
- Consider using connection string with SSL in production

### SQL Injection Protection

- All queries use parameterized statements (prepared statements)
- Never concatenate user input directly into SQL queries
- Input validation and sanitization applied at multiple layers

## Authentication & Authorization

### Role-Based Access Control (RBAC)

- Three roles: `cashier`, `manager`, `admin`
- Role checks implemented via `authorize` middleware
- Admin-only routes protected at route level

### Rate Limiting

- Authentication endpoints: 5 attempts per 15 minutes
- General API endpoints: 100 requests per 15 minutes
- Prevents brute force attacks and API abuse

## Input Validation & Sanitization

### Backend

- All inputs validated via `express-validator`
- XSS protection via `sanitizeMiddleware` (DOMPurify)
- SQL injection protection via parameterized queries

### Frontend

- Form validation on client side
- Type checking via TypeScript
- Input sanitization before API calls

## Network Security

### HTTPS

- **Development**: HTTP allowed for local development
- **Production**: HTTPS should be enforced for all API communications
- Consider using self-signed certificates for local network deployments

### CORS

- CORS configured for development (localhost origins)
- Production: CORS should be disabled or restricted to known origins
- Electron apps don't require CORS (same-origin), but it's configured for safety

## License & Device Fingerprinting

### Device Activation

- Each device requires activation with license key
- Device fingerprinting used to prevent unauthorized device usage
- Fingerprint based on hardware/software characteristics

### License Validation

- License status checked on critical operations
- Trial limits enforced for unlicensed installations
- License expiry handled gracefully

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not create public GitHub issues for security vulnerabilities
2. Contact the development team directly
3. Provide detailed information about the vulnerability
4. Allow reasonable time for fixes before public disclosure

## Security Checklist for Deployment

- [ ] JWT_SECRET set and at least 32 characters
- [ ] Database credentials secured in `.env` file
- [ ] `.env` file not committed to version control
- [ ] HTTPS enabled for API communications
- [ ] Rate limiting configured appropriately
- [ ] License keys properly managed
- [ ] Device activations monitored
- [ ] Regular security updates applied
- [ ] Database backups encrypted
- [ ] Access logs monitored




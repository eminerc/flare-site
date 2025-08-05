# Flare Website

Professional quality mobile photography using diffusion models to replace traditional ISP pipelines.

## Project Structure

```
flare-website/
├── index.html              # Main landing page
├── pages/                  # Additional pages
│   ├── demo.html          # Demo page (coming soon)
│   ├── contact.html       # Contact form
│   └── showcase.html      # Gallery showcase
├── assets/                # Static assets
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript files
│   ├── images/           # Image assets
│   └── icons/            # Icon files
├── components/           # Reusable components
├── backend/             # Backend API structure
│   ├── api/            # API endpoints
│   ├── config/         # Configuration files
│   └── utils/          # Utility functions
└── package.json        # Dependencies and scripts
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- Modern web browser
- Code editor (VS Code recommended)

### Installation

1. Clone the repository or copy the files to your local machine
2. Navigate to the project directory:
   ```bash
   cd flare-website
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Development

#### Start the Node.js development server:
```bash
# Development mode with auto-restart on file changes
npm run dev

# Production mode
npm start

# Both serve at http://localhost:3000
```

#### Alternative: Using Live Server for frontend-only development:
```bash
npm run serve
# Opens at http://localhost:3000 with live reload (frontend only)
```

## Features

### Home Page (index.html)
- Hero section with catchphrase and demo CTA
- Snap-scroll navigation through sections:
  - Product description
  - Interactive before/after demo images
  - Go-to-market strategies (ISP replacement vs. consumer app)
  - "No More..." feature highlights
  - Footer with contact info

### Demo Page (pages/demo.html)
- Currently shows "Coming Soon"
- Backend structure prepared for API integration
- File upload and processing capabilities planned

### Contact Page (pages/contact.html)
- Contact form for partnerships and inquiries
- Same form used for ISP replacement partnerships

### Showcase Page (pages/showcase.html)
- Gallery demonstration
- Search functionality
- Highlights section
- Toggle between enhanced and standard photos

## Technical Implementation

### Frontend
- **HTML5**: Semantic markup with accessibility considerations
- **CSS3**: Modern styling with CSS Grid, Flexbox, and custom properties
- **Vanilla JavaScript**: No framework dependencies for optimal performance
- **Responsive Design**: Mobile-first approach with breakpoints

### Backend Structure (Prepared)
- **Express.js**: RESTful API endpoints
- **Multer**: File upload handling
- **CORS**: Cross-origin resource sharing
- **Environment Configuration**: dotenv for sensitive data

### Key Components
- **Smooth Scroll**: Snap-scroll navigation between sections
- **Image Comparison**: Interactive before/after sliders
- **Gallery System**: Search and filter functionality
- **Form Handling**: Contact and partnership forms

## Customization

### Colors and Branding
Edit `assets/css/main.css` to customize:
- Brand colors (CSS custom properties at the top)
- Typography settings
- Layout spacing

### Content Updates
- **Hero Section**: Edit the main heading and catchphrase in `index.html`
- **Product Description**: Update the detailed description section
- **Demo Images**: Replace placeholder images in `assets/images/demo/`
- **Contact Information**: Update footer details

### Adding New Sections
1. Add HTML structure to `index.html`
2. Add corresponding styles to `assets/css/main.css`
3. Update navigation if needed in `assets/js/main.js`

## Deployment

The website is built with static files and can be deployed to any web server:

### Static Hosting Options
- **Netlify**: Drag and drop deployment
- **Vercel**: Git-based deployment
- **GitHub Pages**: Free hosting for public repositories
- **AWS S3**: Static website hosting

### Traditional Hosting
Upload all files to your web server's public directory.

## Future API Integration

The backend structure is prepared for:
- Demo image processing endpoints
- Contact form submission handling
- Partnership form processing
- User authentication (if needed)
- Image gallery management

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Test across different browsers
4. Submit a pull request

## License

MIT License - see LICENSE file for details.
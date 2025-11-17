const fs = require('fs');

// Get environment variables (Vercel provides these)
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-project-url-here';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key-here';

// Create the config.js content
const configContent = `const CONFIG = {
    SUPABASE_URL: '${SUPABASE_URL}',
    SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}',
};`;

// Write to config.js
fs.writeFileSync('config.js', configContent);
console.log('config.js created successfully!');


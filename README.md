This is a real-time EAA web app compatible with INDI and Alpaca. You can platesolve while viewing a preview, and after platesolving is complete, clickable annotations are displayed, along with links to Wikipedia, SIMBAD, AladinLite, etc. It also features live stacking, auto-centering, and image export functions. It also has a bridge function that converts devices connected via INDI into Alpaca. The local astrometry.net API TSPS is also available on Github.

To use it in a local environment, you will need to install drivers such as INDI or Alpaca, and if you want to use a local solver, you will need to install astrometry.net.

Instructions for using each function and simple operation methods are posted on my blog:

https://tstudioastronomy.blog.fc2.com/blog-category-46.html

Run Locally
Prerequisites: Node.js

Install dependencies: npm install
Set the GEMINI_API_KEY in .env.local to your Gemini API key
Run the app: npm run dev

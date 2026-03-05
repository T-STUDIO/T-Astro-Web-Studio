This is an EAA app specialized for stargazing.
You can operate it while playing back the stream. (You can also use PlateSolving while playing back the stream.)
It operates smoothly and in real time, with features such as clickable annotations (links to Wikipedia, SIMBAT, etc.) and local Astrometry.net support (using https://github.com/T-STUDIO/TSPS).

INDI currently works in environments that implement WebSocket. The mount GOTO command does not work with Alpaca's bridge function.
To run it with INDI, install an INDI server and WebSocket server in your local environment.
It will work as long as the INDI server and WebSocket server are implemented in your local environment.

The app's features are explained on our blog (Japanese only).

https://tstudioastronomy.blog.fc2.com/blog-category-46.html


We also offer a Raspberry Pi distribution that includes this app, an image viewer, and the local Astrometry.net API.

https://tstudioastronomy.blog.fc2.com/blog-entry-625.html
https://tstudioastronomy.blog.fc2.com/blog-entry-812.html


## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

4. npm run build
   Deploy and it will run fast.
   `npm run preview`

It will also work with publicly available web apps if you have INDI and WebSocket set up in your local environment.

https://tstudioastronomy.blog.fc2.com/blog-category-46.html

However, please make sure to turn off browser security.

https://t-studio.github.io/T-Astro-Web-Studio/

This is an EAA web app specialized for real-time observation. Platesolving and auto-centering are possible while viewing the live view. Platesolving is compatible with nova.astrometry.net, and local API solvers are supported via TSPS.

Features include clickable annotations and links to Wikipedia, SIMBAD, and AladinLite.

Includes INDI client and AlpacaBridge functionality. (INDI devices can be converted using AlpacaBridge.)

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run build`→`npm run preview`

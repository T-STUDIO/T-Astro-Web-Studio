This is an EAA app specialized for stargazing.
You can operate it while playing back the stream. (You can also use PlateSolving while playing back the stream.)
It operates smoothly and in real time, with features such as clickable annotations (links to Wikipedia, SIMBAT, etc.) and local Astrometry.net support (using https://github.com/T-STUDIO/TSPS).

INDI currently works in environments that implement WebSocket. The mount GOTO command does not work with Alpaca's bridge function.

To run it with INDI, install an INDI server and WebSocket server in your local environment.

It will work as long as the INDI server and WebSocket server are implemented in your local environment.
# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/dfebd7b3-52e7-425f-a036-36cc7124f4a3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

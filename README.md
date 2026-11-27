# Cuber

Cuber is a Rubik’s Cube simulator built with React, JavaScript, and PHP. Its exploded view keeps the 3×3 structure visible while the pieces are spaced apart.

Press **Q** or **E** to orbit the view. The same controls work with the 2×2 exposed.

Select a corner or edge, then choose a highlighted piece of the same type. Cuber moves the selected piece to that position through legal face turns. The face controls and keyboard shortcuts also turn layers directly. Solve plays back a solution with pause and step controls.

## Core Mode

Choose **Explode** to bring the current cube’s eight corners together as a playable 2×2. The edges and centers fan out to the sides. Face turns, corner selection, and undo operate on the same puzzle and move history in both views.

Solve the 2×2 by hand or use **Solve core**. Its corner solver runs in a web worker and searches by corner position and orientation. Choose **Reassemble** to see the full 3×3 and finish any remaining edges.

## Linked Core

Choose **Linked** to open a separate challenge. **Explode** reveals the 2×2 core, and **Reassemble** shows the full 3×3. Classic and Linked keep their own progress while the app is open.

Every corner is paired with an edge, and the eight pairs form a chain. Click two neighboring corners, use a numbered swap button, or press **1–7** to exchange adjacent pairs. Restoring the eight corners, including their orientations, restores the entire cube. **Solve both** plays back the swaps and any corner twists needed to finish.

## Corner twists

Select a corner in either puzzle and choose **Clockwise** or **Counterclockwise** below the viewport. The direction is viewed from the tip of the selected corner. The diagonally opposite corner twists the other way, so the result can be reached using ordinary face turns. **Undo** reverses the paired twist in one step.

## Run locally

Install Node.js 22.12 or later and PHP 8.2 or later. Run `npm ci` from the project folder.

Start the PHP API in one terminal.

```sh
php -S 127.0.0.1:8000 -t server/public
```

If you keep a portable Windows copy of PHP in `.local/php/`, start it with `& '.local/php/php.exe' -S 127.0.0.1:8000 -t server/public` in PowerShell.

Start Vite in a second terminal.

```sh
npm run dev
```

Open [the local simulator](http://localhost:5173). Vite forwards `/api` requests to PHP.

## Deploy to Vercel

Import this repository into a Vercel Hobby project and deploy from the repository root. Vercel detects `Dockerfile.vercel` and selects the Container preset. The image builds the React frontend and serves it alongside the PHP API with FrankenPHP, so Classic mode uses the same `/api/cube.php` path in production.

## How solving works

The JavaScript model tracks each piece’s position and the direction of its stickers. PHP generates a 20-move scramble and solves states created in the simulator by reversing their recorded moves and inverting the turns. It also combines consecutive turns of the same face. The MVP takes its history from the simulator, so it can solve any scramble or sequence you create there.

## Checks

- `npm test` checks sticker placement, turn directions, and routes between pieces.
- `npm run test:api` checks PHP validation and verifies that a PHP solution restores the JavaScript cube. Run it while the PHP server is running.
- `npm run build` builds the React frontend in `dist/`.

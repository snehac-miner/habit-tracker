# Day by day

A simple habit tracker built with plain HTML, CSS, and JavaScript. Open
`index.html` in your browser; no installation or build step is required.

Add habits, toggle today's completion, and see current streaks and the last
seven days. Habits and your light/dark preference are saved in this browser's
localStorage. Dates use your local calendar.

## Checks

With Node.js 24 or newer:

```sh
node --check app.js
node --test
```

GitHub Actions runs these commands on every push and pull request. You can also
run the **Checks** workflow manually from the repository's Actions tab.
The dependency-free tests cover local dates, weekly ranges, streaks across
calendar/DST boundaries, and theme initialization/storage errors. They do not
replace visual or interactive browser testing.

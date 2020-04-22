<div align="center">
	<h1>Extract PRPL</h1>
	<p>Get all the Hints from a webpage.</p>
</div>

[![Platform: Now V2](https://img.shields.io/badge/platform-Now%20V2-50e3c2.svg)](https://zeit.co/now)

## Understanding the PRPL pattern

[Apply instant loading with the PRPL pattern](https://web.dev/apply-instant-loading-with-prpl/)

## Local testing

I have no idea how local testing for Now is supposed to work, so I created a tiny HTTP server in `dev.js` that calls the actual function that gets deployed.
Run `npm run dev` to run a local version of the function for local testing.

## Query Params

- device (m): Which kind of device do you want to use in your tests. Should be one of -> m, t, d
- url: URLEncode of the url that ypu want to test.
- cdn: String to use in the filter of the results.
- strategy (allEvaluations): Which stategy do you want to use to filter the hints. Should be one of -> allEvaluations, longestEvaluation
  - allEvaluations: Just all scripts evaluated, and coming from your CDN. Should be your [ShellApp](https://developers.google.com/web/fundamentals/architecture/app-shell) at least.
  - longestEvaluation: From `allEvaluations` select the biggest evaluation, calculate his order of magnitude and use all the hints in the same order.

## Deployment

Using [Now](https://zeit.co/now): `now`.

```sh
$ now --prod -t $NOW_TOKEN
```


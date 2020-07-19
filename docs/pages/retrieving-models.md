---
title: Retrieving Models
---

# Retrieving Models

Once you have defined a model, you are ready to start retrieving data from your database.

Esix is using the **ActiveRecord** pattern which makes it super easy to query data. For Example:

```ts
const flights = await Flight.all();

flights.forEach(flight => {
  console.log(flight.name);
});
```

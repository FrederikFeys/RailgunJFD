# RailgunJFD
Jurne Decadt, Frederik Feys en Dieter Debou

## PM2 Service

Install PM2
```
npm install pm2@latest -g

```

Start the railgun application
```
sudo su
pm2 start railgunjfd.js
pm2 startup
past given path
```
## Shooting

1) Connecting with Pi using nRF Connect app on your phone
2) Unknown Service > Unknown Characteristic (charge)  => there you can give a new value to charge in hexa value.
3) Unknown Service > Unknown Characteristic (shoot)   => there you can give a new value to shoot.

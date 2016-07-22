'use strict';

var Pokeio = require('./poke.io');
var GoogleMapsAPI = require('googlemaps');
var Slack = require('slack-node');
var dateformat = require('dateformat');
var config = require(__dirname + '/config.json');
//Set environment variables or replace placeholder text
var location = {
    type: 'name',
    name: '6095 Emerald Pkwy Dublin, OH 43016',
    coords: { // IBM Dublin Office Building 2
        latitude: 40.077216,
        longitude: -83.137707,
        altitude: 0
    }
};

var webhookUrl = process.env.SLACK_URL || config.slack;

var username = process.env.PGO_USERNAME || config.user;
var password = process.env.PGO_PASSWORD || config.pass;
var provider = process.env.PGO_PROVIDER || config.provider;

// Initialize Google Maps API
var googleConfig = {
    key: process.env.MAPS_API_KEY || config.maps
}
var gmAPI = new GoogleMapsAPI(googleConfig);

// Initialize Slack API
var slack = new Slack();
slack.setWebhook(webhookUrl);

// Search for nearby Pokemon
Pokeio.init(username, password, location, provider, function(err) {
    if (err) throw err;

    console.log('[i] Current location: ' + Pokeio.playerInfo.locationName);
    console.log('[i] lat/long/alt: : ' + Pokeio.playerInfo.latitude + ' ' + Pokeio.playerInfo.longitude + ' ' + Pokeio.playerInfo.altitude);

    Pokeio.SetLocation(location, function(err, loc) {
        if (err) throw err;

        Pokeio.Heartbeat(function(err, hb) {
            if(err) console.log(err);

            for (var i = hb.cells.length - 1; i >= 0; i--) {
                if (hb.cells[i].WildPokemon[0]) {
                  for (var j = hb.cells[i].WildPokemon.length - 1; j >= 0; j--) {
                    var pokemon = Pokeio.pokemonlist[parseInt(hb.cells[i].WildPokemon[j].pokemon.PokemonId)-1]
                    var location = hb.cells[i].WildPokemon[j].Latitude + ',' + hb.cells[i].WildPokemon[j].Longitude
                    var ttl = hb.cells[i].WildPokemon[j].TimeTillHiddenMs;

                    console.log('[+] ' + pokemon.name + ' at  ' + location);

                    // Get Static Map of Pokemon Location
                    var params = {
                      center: location,
                      zoom: 17,
                      size: '500x400',
                      maptype: 'roadmap',
                      markers: [
                        {
                          location: location,
                          icon: pokemon.img,
                          scale: 2
                        }
                      ]
                    };
                    var mapUrl = gmAPI.staticMap(params);

                    // Post Results to Slack webhook
                    slack.webhook({
                        username: 'PokeBot',
                        text: 'I\'ve detected this ' + pokemon.name + ' nearby!',
                        icon_emoji: 'https://lh6.ggpht.com/YphYdqVDuLK4ZY-tCpdCdl3ZbES-hXfozgfamNQcYXmLZKLTA86Xe_2bhOCjc097fCA=w300',
                        attachments: [
                            {
                                fallback: 'Go to these coordinates: ' + location,
                                pretext: 'Disappears at ' + despawnTime(ttl),
                                image_url: mapUrl
                            }
                        ]
                    }, function(err, response) {
                        if (err) console.err(err);
                    });
                  }
                }
            }

        });

    });
});

function despawnTime(ttl) {
  var currentTime = new Date().getTime();
  return dateformat(new Date(currentTime + ttl), 'h:MM:ss TT');
}

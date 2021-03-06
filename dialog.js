var Botkit = require('botkit');
var builder = require('botbuilder');
var https = require('https');
var querystring = require('querystring');
var prompts = require('./prompts');

var model = process.env.LUIS_MODEL;

module.exports = new builder.LuisDialog(model)
    .onDefault(builder.DialogAction.send(prompts.userWelcomeMessage))
    .on('LoadProfile', [
        confirmUsername, getProfile, confirmProperty, displayInformation
    ])
    .on('SearchProfile', [
        confirmQuery, searchProfiles, getProfile, confirmProperty, displayInformation
    ]);

function confirmQuery(session, args, next) {
    session.dialogData.entities = args.entities;
    var query = builder.EntityRecognizer.findEntity(args.entities, 'query');

    if(query) {
        next({ response: query.entity });
    } else {
        builder.Prompts.text(session, 'Who are you searching for?');
    }
}

function searchProfiles(session, results, next) {
    var query = session.dialogData.query = results.response;
    if(!query) {
        session.endDialog('Request cancelled...');
    } else {
        executeSearch(query, function(profiles) {
            var totalCount = profiles.total_count;
            if(totalCount == 0) {
                session.endDialog('Sorry, no results found.');
            } else if(totalCount > 10) {
                session.endDialog('More than 10 results were found. Please provide a more restrictive query.');
            } else {
                session.dialogData.property = null;
                var usernames = profiles.items.map(function(item) { return item.login });
                builder.Prompts.choice(session, 'What user do you want to load?', usernames);
            }
        });
    }
}

function confirmUsername(session, args, next) {
    session.dialogData.entities = args.entities;

    var username = builder.EntityRecognizer.findEntity(args.entities, 'username');
    if(username) {
        next({ response: username.entity });
    } else if(session.dialogData.username) {
        next({ response: session.dialogData.username });
    } else {
        builder.Prompts.text(session, 'What is the username?');
    }
}

function getProfile(session, results, next) {
    var username = results.response;

    if(username.entity) username = session.dialogData.username = username.entity;
    else session.dialogData.user = username;

    if(!username) {
        session.endDialog('Request cancelled.');
    } else if(session.dialogData.profile && typeof(session.dialogData.profile.login) !== 'undefined' && session.dialogData.profile.login.toLowerCase() == username.toLowerCase()) {
        next();
    } else {
        loadProfile(username, function(profile) {
            if(profile && profile.message !== 'Not Found') {
                session.dialogData.profile = profile;
                next();
            } else {
                session.endDialog('Sorry, couldn\'t find a profile with that name. You can do a search for a profile.');
            }
        });
    }
}

function confirmProperty(session, results, next) {
    var property = builder.EntityRecognizer.findEntity(session.dialogData.entities, 'property');
    if(property) {
        next({ response: property.entity });
    } else if(session.dialogData.property) {
        next({ response: session.dialogData.property });
    } else {
        builder.Prompts.text(session, 'What did you want to know?');
    }
}

function displayInformation(session, results, next) {
    var property = session.dialogData.property = results.response;
    if(!property) {
        session.endDialog('Request cancelled.');
    } else {
        property = builder.EntityRecognizer.findBestMatch(properties, property);
        if(!property) {
            session.send('Sorry, I don\'t know about %s', results.response);
            session.send('I can tell you about the following: %s', properties.join(','));
        } else {
            var profile = session.dialogData.profile;
            var value = profile[property.entity];
            var name = profile.name ? profile.name : profile.login;
            if(value) session.send('Here is the %s for %s: %s', property.entity, name, value);
            else session.send('Sorry, I don\'t have a record for %s for %s', property.entity, name);
        }
    }
}

// -- helper functions

function executeSearch(query, callback) {
    loadData('/search/users?q=' + querystring.escape(query), callback);
}

function loadProfile(username, callback) {
    loadData('/users/' + querystring.escape(username), callback);
}

function loadData(path, callback) {
    var options = {
        host: 'api.github.com',
        port: 443,
        path: path,
        method: 'GET',
        headers: {
            'User-Agent': 'sample-bot'
        }
    };
    var profile;
    var request = https.request(options, function (response) {
        var data = '';
        response.on('data', function (chunk) { data += chunk; });
        response.on('end', function () {
            callback(JSON.parse(data));
        });
    });
    request.end();
}

var properties = ['email', 'name', 'bio', 'location', 'company'];
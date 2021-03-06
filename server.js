var Botkit = require('botkit');
var builder = require('botbuilder');
var http = require('http');
var querystring = require('querystring');
var restify = require('restify');
var dotenv = require('dotenv');

dotenv.load();

var ConnectorBot = require('./connector');
var SlackBot = require('./slack.js');
var TextBot = require('./text.js');

var connectorBot = ConnectorBot.start();
var slackBot = SlackBot.start();
var textBot = TextBot.start();
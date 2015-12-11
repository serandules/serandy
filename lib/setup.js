var request = require('request');
var shell = require('shelljs');
var util = require('util');
var async = require('async');

var gitQueue = async.queue(function (url, done) {
    console.log('cloning repo: %s', url);
    shell.exec(util.format('git clone %s', url), function (code, output) {
        if (code !== 0) {
            console.log('error cloning repo: %s, error: %s', url, code);
            return done();
        }
        console.log('cloning successful repo: %s', url);
        done();
    });
}, 10);

var clone = function(repo) {
    console.log('cloning %s repositories', repo);
    request({
        url: util.format('https://api.github.com/users/%s/repos?per_page=%d', repo, 100),
        headers: {
            'User-Agent': 'curl/7.35.0'
        }
    }, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            console.error(error || response.statusMessage);
            return;
        }
        var repos = JSON.parse(body);
        repos.forEach(function (repo) {
            gitQueue.push(repo.clone_url);
        });
    });
};

module.exports = function (env, options) {
    console.log('setting up serandives %s environment', env || 'dev');
    clone('serandules');
    clone('serandomps');
};
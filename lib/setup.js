var request = require('request');
var shell = require('shelljs');
var util = require('util');
var async = require('async');
var fs = require('fs');

var user = 'root';

var byUser = function (cmd) {
  return util.format('sudo -u %s bash -c "%s"', user, cmd);
};

var cloneQueue = async.queue(function (job, done) {
  var url = job.url;
  var dir = job.dir;
  console.log('cloning repo: %s', url);
  shell.exec(byUser(util.format('git clone %s %s', url, dir)), function (code, output) {
    if (code !== 0) {
      return done(util.format('error cloning repo: %s, error: %s', url, code));
    }
    console.log('cloning successful repo: %s', url);
    done();
  });
}, 10);

var clone = function (repo, done) {
  console.log('cloning %s repositories', repo);
  fs.mkdir(repo, function (err) {
    request({
      url: util.format('https://api.github.com/users/%s/repos?per_page=%d', repo, 100),
      headers: {
        'User-Agent': 'curl/7.35.0'
      }
    }, function (error, response, body) {
      if (error || response.statusCode !== 200) {
        return console.error(error || response.statusMessage);
      }
      var jobs = [];
      var repos = JSON.parse(body);
      repos.forEach(function (repo) {
        jobs.push(function (done) {
          cloneQueue.push({
            url: repo.clone_url,
            dir: repo.full_name
          }, done);
        });
      });
      async.parallel(jobs, function (err) {
        if (err) {
          console.error(err);
          return done(err);
        }
        var cmd = 'find %s/*/.git -iname "config" | ' +
          'xargs grep -l "url = https://github.com/%s" | ' +
          'xargs sed -i -e "s,url = https://github.com/%s,url = https://%s@github.com/%s,g"';
        shell.exec(byUser(util.format(cmd, repo, repo, repo, repo, repo)), function (code) {
          done(code !== 0 ? util.format('error updating remote urls repos: %s', repo) : null);
        });
      });
    });
  });
};

var cloneRepos = function (done) {
  var jobs = {
    serandules: function (done) {
      clone('serandules', done);
    },
    serandomps: function (done) {
      clone('serandomps', done);
    }
  };
  async.parallel(jobs, function (err) {
    if (err) {
      return done(err);
    }
    console.log('all repos cloned successfully');
    done();
  });
};

var npmLocal = function (done) {
  var cmd = 'for dir in ./*; do cd $dir; for mod in ./*; do cd $mod; npm install; cd ..; done; cd ..; done;';
  shell.exec(byUser(cmd), function (code) {
    done(code !== 0);
  });
};

var npmGlobal = function (done) {
  var pre = ['sharp']
  console.log('assuming following node modules have been already installed: %s', pre.concat(','));
  var modules = ['component'];
  var cmd = '';
  modules.forEach(function (module) {
    cmd += util.format('npm install -g %s', module);
  });
  shell.exec(byUser(cmd), function (code) {
    done(code !== 0);
  });
};

var hosts = function (done) {
  var hosts = ['hub.serandives.com', 'autos.serandives.com', 'accounts.serandives.com', 'serandives.com'];
  var cmd = "sudo echo $'";
  hosts.forEach(function (host) {
    cmd += util.format("\n127.0.0.1\t%s", host);
  });
  cmd += "' >> /etc/hosts";
  shell.exec(cmd, function (code) {
    done(code !== 0);
  });
};

module.exports = function (env, options) {
  env = env || 'dev';
  user = options.user;
  if (!user) {
    return console.error('please specify --user option');
  }
  var tasks = [];
  if (options.clone) {
    tasks.push(cloneRepos);
  }
  if (options.globals) {
    tasks.push(npmGlobal);
  }
  if (options.locals) {
    tasks.push(npmLocal);
  }
  if (options.hosts) {
    tasks.push(hosts);
  }
  console.log('setting up serandives %s environment', env);
  async.waterfall(tasks, function (err) {
    if (err) {
      console.error('error setting up serandives %s environment', env);
      return console.error(err);
    }
    console.log('successfully setup serandives %s environment', env);
  });
};
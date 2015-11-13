var source = require('vinyl-source-stream');
var gulp = require('gulp');
var gutil = require('gulp-util');
var gulpif = require('gulp-if');
var fs = require('fs');
var browserify = require('browserify');
var babelify = require('babelify');
var watchify = require('watchify');
var bowerResolve = require('bower-resolve');
var nodeResolve = require('resolve');
var less = require('gulp-less');
var importify = require('gulp-importify');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');

var config = require('./gulp/config');
var utils = require('./gulp/utils');
var manifest = require('./gulp/asset-manifest');

var VERSION = Math.floor(Date.now() / 1000);

function getBundler(watch) {
  var props = {
    debug: !utils.isProduction(),
    transform: [babelify],
  };

  return watch ? watchify(browserify(props)) : browserify(props);
}


function bundleCss(src, name) {
  var sourceFile = outputFile = name+'.css';
  if (utils.isProduction()) outputFile = name+'-'+VERSION+'.css';

  var stream = gulp.src(src)
    .pipe(importify(name+'.less', {cssPreproc: 'less'}))
    .pipe(less())
    .pipe(minifyCss())
    .pipe(rename(outputFile))
    .pipe(gulp.dest(config.cssBuildDirectory));

  manifest.update(sourceFile, outputFile);

  return stream;
}

gulp.task('common', function(){
  var sourceFile = outputFile = 'common.js';
  if (utils.isProduction()) outputFile = 'common-'+VERSION+'.js';

  var bundler = getBundler(false);

  utils.getBowerDependencies().forEach(function (pkg) {
    var resolvedPath = bowerResolve.fastReadSync(pkg);
    try {
      fs.accessSync(resolvedPath, fs.R_OK);
      bundler.require(resolvedPath, {expose: pkg});
    } catch (e) {
      // no op: no readable file exists
    }
  });

  utils.getNpmDependencies().forEach(function (pkg) {
    bundler.require(nodeResolve.sync(pkg), {expose: pkg});
  });

  var stream = bundler.bundle()
    .on('error', function(err){
      console.log(err.message);
      this.emit('end');
    })
    .pipe(source(sourceFile))
    // Do thingly like uglify here
    .pipe(rename(outputFile))
    .pipe(gulp.dest(config.jsBuildDirectory));

  manifest.update(sourceFile, outputFile);

  return stream;
});


gulp.task('build', function() {
  var sourceFile = outputFile = 'main.js';
  if (utils.isProduction()) outputFile = 'main-'+VERSION+'.js';

  var bundler = getBundler(false);
  bundler.add(config.mainJsFile);

  utils.getBowerDependencies().forEach(function (pkg) {
    bundler.external(pkg);
  });

  utils.getNpmDependencies().forEach(function (pkg) {
    bundler.external(pkg);
  });

  var stream = bundler.bundle()
    .on('error', function(err){
      console.log(err.message);
      this.emit('end');
    })
    .pipe(source(sourceFile))
    // Do thingly like uglify here
    .pipe(rename(outputFile))
    .pipe(gulp.dest(config.jsBuildDirectory));

  manifest.update(sourceFile, outputFile);

  return stream;
});


gulp.task('watch-js', function() {
  var bundler = getBundler(true);
  bundler.add(config.mainJsFile);

  utils.getBowerDependencies().forEach(function (pkg) {
    bundler.external(pkg);
  });

  utils.getNpmDependencies().forEach(function (pkg) {
    bundler.external(pkg);
  });

  function rebundle() {
    var stream = bundler.bundle();
    return stream
      .on('error', function(err){
        console.log(err.message);
        this.emit('end');
      })
      .pipe(source('main.js'))
      .pipe(gulp.dest(config.jsBuildDirectory));
  }

  // listen for an update and run rebundle
  bundler.on('update', function() {
    rebundle();
    gutil.log('Rebundle...');
  });

  return rebundle();
});

gulp.task('watch-css', function () {
  gulp.watch(config.appCssFiles, ['css']);
});

gulp.task('watch', ['watch-js', 'watch-css']);

gulp.task('css', function() {
  return bundleCss(config.appCssFiles, 'main');
});

gulp.task('common-css', function() {
  return bundleCss(config.commonCss, 'common');
});

gulp.task('build-all', ['common' ,'build', 'common-css' ,'css']);

// run 'scripts' task first, then watch for future changes
gulp.task('default', ['build']);

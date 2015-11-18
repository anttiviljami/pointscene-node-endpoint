var gulp = require('gulp')
var symlink = require('gulp-sym')

gulp.task('install', function() {
  gulp
    .src('pointscene.js')
    .pipe(symlink('/usr/local/bin/pointscene'))
})


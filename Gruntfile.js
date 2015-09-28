module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        separator: ''
      },
      build: {
        src: [
          'src/client/P2PTV.js',
          'src/client/Stream.js',
          'src/client/Player.js',
          'src/client/Peer.js',
          'src/client/InitSegment.js',
          'src/client/MediaSegment.js',
          'src/client/PushPullWindow.js',
        ],
        dest: 'build/<%= pkg.name %>.js',
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> v<%= pkg.version %>  */\n'
      },
      build: {
        files: {
          'build/<%= pkg.name %>.min.js': ['<%= concat.build.dest %>'],
        }
      }
    },
    copy: {
      main: {
        src: '<%= concat.build.dest %>',
        dest: 'example/html/js/<%= pkg.name %>.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('default', ['concat', 'copy']);
  grunt.registerTask('build', ['concat', 'uglify', 'copy']);

};

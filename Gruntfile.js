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
          'src/client/Encoder.js',
          'src/client/Decoder.js',
          'src/client/InitSegment.js',
          'src/client/MediaSegment.js',
          'src/client/Window.js',
        ],
        dest: 'build/<%= pkg.name %>.js'
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> v<%= pkg.version %>  */\n'
      },
      build: {
        files: {
          'build/<%= pkg.name %>.min.js': ['<%= concat.build.dest %>']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('default', ['concat', 'uglify']);

};

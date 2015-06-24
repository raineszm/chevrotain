var _ = require('lodash')
var findRefs = require('./scripts/findRefs')
var specsFiles = require('./scripts/findSpecs')("bin/tsc/test/", "test")

// TODO: this is a bit ugly, but including the root and then performing negation
//       seems to cause inclusion of things outside the root...
var githubReleaseFiles = ['./package.json',
    './LICENSE.txt',
    "./bin/chevrotain.d.ts",
    "./bin/chevrotain.js",
    './readme.md'
]


module.exports = function(grunt) {

    var pkg = grunt.file.readJSON('package.json')

    // this helps reduce mistakes caused by the interface between the screen and the chair :)
    var bower = grunt.file.readJSON('bower.json')
    if (pkg.dependencies.lodash !== bower.dependencies.lodash) {
        throw Error("mismatch in bower and npm lodash dependency version")
    }

    //noinspection UnnecessaryLabelJS
    grunt.initConfig({
        pkg: pkg,

        karma: {
            options: {
                configFile: 'karma.conf.js',
                singleRun:  true,
                browsers:   ['Chrome']
            },

            dev_build: {},

            tests_on_browsers: {
                options: {
                    files:    ['bower_components/lodash/lodash.js', 'test.config.js', 'bin/chevrotain.js', 'bin/chevrotainSpecs.js'],
                    browsers: ['Chrome', 'Firefox', 'IE']
                }
            }
        },

        mocha_istanbul: {
            coverage: {
                src: 'bin/chevrotain.js',
                options: {
                    root: './bin/',
                    mask: '*tainSpecs.js',
                    coverageFolder: 'bin/coverage',
                    excludes: ['*tainSpecs.js']
                }
            },
        },

        istanbul_check_coverage: {
            default: {
                options: {
                    coverageFolder: 'bin/coverage',
                    check: {
                        statements: 100,
                        branches:   0,
                        lines:      100,
                        functions:  100
                    }
                }
            }
        },

        tslint: {
            options: {
                configuration: grunt.file.readJSON("tslint.json")
            },

            files: {
                src: ['src/**/*.ts', 'test/**/*.ts']
            }
        },

        ts: {
            options: {
                bin:  "ES5",
                fast: "never"

            },

            dev_build: {
                src:    ["**/*.ts", "!node_modules/**/*.ts", "!build/**/*.ts", "!bin/**/*.ts"],
                outDir: "bin/gen"
            },

            release: {
                src:     ['build/chevrotain.ts'],
                out:     'bin/chevrotain.js',
                options: {
                    declaration:    true,
                    removeComments: false,
                    sourceMap:      false // due to UMD and concat generated headers the original source map will be invalid.
                }
            },

            // this is the same as the 'build' process, all .ts --> .js in gen directory
            // in a later step those files will be aggregated into separate components
            release_test_code: {
                src:     ["**/*.ts", "!node_modules/**/*.ts", "!build/**/*.ts", "!bin/**/*.ts"],
                outDir:  "bin/tsc",
                options: {
                    declaration:    true,
                    removeComments: false,
                    sourceMap:      false // due to UMD and concat generated headers the original source map will be invalid.
                }
            }
        },

        umd: {
            release: {
                options: {
                    src:            'bin/chevrotain.js',
                    template:       'scripts/umd.hbs',
                    objectToExport: 'API',
                    amdModuleId:    'chevrotain',
                    globalAlias:    'chevrotain',
                    deps:           {
                        'default': ['_'],
                        amd:       ['lodash'],
                        cjs:       ['lodash'],
                        global:    ['_']
                    }
                }
            },

            release_specs: {
                options: {
                    src:      'bin/chevrotainSpecs.js',
                    template: 'scripts/umd.hbs',
                    deps:     {
                        'default': ['_', 'config', 'chevrotain'],
                        amd:       ['lodash', '../test.config.js', 'chevrotain'],
                        cjs:       ['lodash', '../test.config.js', './chevrotain'],
                        global:    ['_', "undefined", 'chevrotain']
                    }
                }
            }
        },

        clean:  {
            all: ["bin/"]
        },
        concat: {
            options: {
                banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
                        '<%= grunt.template.today("yyyy-mm-dd") %> */\n',

                process: function fixTSModulePatternForCoverage(src, filePath) {
                    // prefix (lang = chevrotain.lang || (chevrotain.lang = {}) with /* istanbul ignore next */
                    var fixed2PartsModules = src.replace(
                        /(\((\w+) = (\w+\.\2) \|\|) (\(\3 = \{}\)\))/g, "/* istanbul ignore next */ $1 /* istanbul ignore next */ $4")

                    var fixedAllModulesPattern = fixed2PartsModules.replace(
                        /(\(chevrotain \|\| \(chevrotain = \{}\)\);)/g, "/* istanbul ignore next */ $1")

                    var fixedTypeScriptExtends = fixedAllModulesPattern.replace("if (b.hasOwnProperty(p)) d[p] = b[p];",
                        "/* istanbul ignore next */ " + " if (b.hasOwnProperty(p)) d[p] = b[p];")

                    // TODO: try to remove this with typescript 1.5+. this replace is done in the grunt file due to bug in tsc 1.4.1
                    // TODO: that in certain situations removes the comments.
                    // very little point in testing this, this is a pattern matching functionality missing in typescript/javascript
                    // if the code reaches that point it will go "boom" which is the purpose, the going boom part is not part
                    // of the contract, it just makes sure we fail fast if we supply invalid arguments.
                    var fixedNoneExhaustive = fixedTypeScriptExtends.replace(/(default\s*:\s*throw\s*Error\s*\(\s*["']non exhaustive match["']\s*\))/g,
                        "/* istanbul ignore next */ $1")

                    fixedNoneExhaustive = fixedNoneExhaustive.replace(/(throw\s*Error\s*\(\s*["']non exhaustive match["']\s*\))/g,
                        "/* istanbul ignore next */ $1")

                    return fixedNoneExhaustive
                }
            },
            release: {
                files: {
                    'bin/chevrotain.js':      ['bin/chevrotain.js'],
                    'bin/chevrotainSpecs.js': specsFiles
                }
            }
        },

        // TODO: instead of compressing maybe just commit the generated stuff to github?
        // that would be easy to do as the release jobs already perform a commit...
        compress: {
            github_release_zip: {
                options: {
                    archive: 'package/chevrotain-binaries-' + pkg.version + '.zip'
                },
                files:   [{src: githubReleaseFiles, dest: '/'}]
            },
            github_release_tgz: {
                options: {
                    archive: 'package/chevrotain-binaries-' + pkg.version + '.tar.gz'
                },
                files:   [{src: githubReleaseFiles, dest: '/'}]
            }
        }
    })

    var releaseBuildTasks = [
        'clean:all',
        'ts:release',
        'ts:release_test_code',
        'tslint',
        'concat:release',
        'umd:release',
        'umd:release_specs',
        'compress'
    ]

    var commonReleaseTasks = releaseBuildTasks.concat(['mocha_istanbul', 'istanbul_check_coverage'])

    grunt.loadNpmTasks('grunt-karma')
    grunt.loadNpmTasks('grunt-tslint')
    grunt.loadNpmTasks("grunt-ts")
    grunt.loadNpmTasks('grunt-umd')
    grunt.loadNpmTasks('grunt-contrib-clean')
    grunt.loadNpmTasks('grunt-contrib-concat')
    grunt.loadNpmTasks('grunt-contrib-compress')
    grunt.loadNpmTasks('grunt-mocha-istanbul');


    grunt.registerTask('build', releaseBuildTasks)
    grunt.registerTask('build_and_test', commonReleaseTasks)
    grunt.registerTask('test', ['mocha_istanbul', 'istanbul_check_coverage'])
    grunt.registerTask('build_and_test_plus_browsers', commonReleaseTasks.concat(['karma:tests_on_browsers']))

    grunt.registerTask('dev_build', [
        'clean:all',
        'ts:dev_build',
        'tslint',
        'karma:dev_build'])
}
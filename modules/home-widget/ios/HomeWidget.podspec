Pod::Spec.new do |s|
  s.name           = 'HomeWidget'
  s.version        = '1.0.0'
  s.summary        = 'Today plan home screen widget bridge for Microphone Check'
  s.description    = 'Shares the current day plan with the WidgetKit extension and reloads its timelines.'
  s.author         = 'ercode'
  s.homepage       = 'https://github.com/ErcouldnT/microphone-check'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: 'https://github.com/ErcouldnT/microphone-check' }
  s.static_framework = true
  s.license        = { :type => 'MIT' }

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

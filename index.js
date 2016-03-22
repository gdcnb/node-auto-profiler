'use strict';

var fs = require('fs');
var profiler = require('v8-profiler');
var usage = require('usage');
var path = require('path');
var Keys = Object.keys;

var defaultOptions = {
  root: path.resolve(__dirname).replace(/\/+$/, ''), //生成日志的目录 默认为运行脚本同级的目录
  //profileLogTime: 30000, //日志收集时间 默认为30s
  profileLogTime: 5000, //日志收集时间 默认为30s
  cpuThreshold: 90 //收集日志的阀值
};

var _cpuLock = false; //写日志锁
var _cpuThresholdNumber = 0; //达到设定阀值的次数 连续6次才开始记录
var _profilerHasInited = false;

function _stopLog (profile){
  console.log('==========> stop');
  profile.delete();

  //重置
  _cpuLock = false;
  _cpuThresholdNumber = 0;
}

function _checkToLog(cpu) { //cpu 达到设定阀值且要连续6次才开始记录
  if(_cpuLock) {
    console.log('=============> cpuLocked');
    return false;
  }

  if(cpu > defaultOptions.cpuThreshold) {
    _cpuThresholdNumber ++;

    console.log('================> _cpuThresholdNumber=', _cpuThresholdNumber, _cpuThresholdNumber === 6);
    return _cpuThresholdNumber === 1; //连续有6次超过阀值才开始记录日志
  } else {
    console.log('===============> zero');
    _cpuThresholdNumber = 0; //只要有一次不是就要归0
    return false;
  }
}

/**
 * 进程cpu监控启动方法，根据设置的cpu的阀值自动收集日志，并写到指定的目录下面
 * @param options = {
 *  root: 'path', //生成日志的目录
    profileLogTime: 30000, //日志收集时间 默认为30s
    cpuThreshold: 90 //收集日志的阀值
 * }
 * @param cbFun
 */
exports.monitoring = function(options, cbFun) {
  if(options && typeof options === 'object') {
    Keys(options).forEach(function(key){
      defaultOptions[key] = options[key];
    });
  }

  setInterval(function() {
    usage.lookup(process.pid, {keepHistory: true}, function(err, result) {
      if(!err) {
        if(_checkToLog(result.cpu)) {
          console.log('==============> start log');
          _cpuLock = true; //锁住记录cpu的profile

          profiler.startProfiling();
          console.log('===========> startProfiling');
          setTimeout(function() {
            var profile = profiler.stopProfiling();
            profile.export()
                .pipe(fs.createWriteStream(options.root + '/profile_' + process.pid + '_' + Date.now()+'.cpuprofile'))
                .on('error',  function() { _stopLog(profile);})
                .on('finish', function() {_stopLog(profile);})
          }, defaultOptions.profileLogTime);
        }

        if(arguments.length === 2 && cbFun) { //回调函数
          cbFun(result);
        }
      }
    });
  }, 1000);
};
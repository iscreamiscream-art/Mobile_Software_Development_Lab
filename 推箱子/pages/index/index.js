// pages/index/index.js
Page({
  data: {
    levels: ['level01.png', 'level02.png', 'level03.png', 'level04.png'],
    cleared: {} // 已通关的关卡，如 {0: true}
  },
  // 每次回到首页刷新通关状态
  onShow() {
    var cleared = wx.getStorageSync('clearedLevels') || []
    var map = {}
    for (var i = 0; i < cleared.length; i++) {
      map[parseInt(cleared[i], 10)] = true // 兼容字符串/数字格式
    }
    this.setData({ cleared: map })
  },
  // 自定义函数 -- 游戏选关
  chooseLevel: function (e) {
    let level = e.currentTarget.dataset.level
    wx.navigateTo({
      url: '../game/game?level=' + level
    })
  }
})

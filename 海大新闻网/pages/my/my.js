// pages/my/my.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLogin: false,   // 是否已登录（微信账号）
    src: '',          // 用户头像（尽力获取，失败用默认占位）
    nickName: '微信用户', // 用户昵称
    newsList: [],     // 收藏列表
    number: 0,        // 收藏数量
    historyList: [],  // 浏览历史列表
    historyNumber: 0, // 浏览历史数量
    activeTab: 'fav'  // 当前标签：fav=收藏 / history=历史
  },

  // 微信账号登录：先弹授权框选择微信账户，再 wx.login 获取登录凭证 code
  // 真实项目中：需将 code 发送到后端，后端调用
  // https://api.weixin.qq.com/sns/jscode2session 换取 openid/session_key，
  // 并返回自定义登录态 token。本项目无后端，这里本地建立登录态演示。
  login: function () {
    let that = this
    // 第一步：弹出微信授权确认框（选择微信账户并授权头像昵称），
    // 用户点「允许」后才继续登录，点「拒绝」则中止
    if (!wx.getUserProfile) {
      // 低版本基础库不支持授权弹窗，降级为静默登录
      that.loginByCode()
      return
    }
    wx.getUserProfile({
      desc: '用于登录海大新闻网',
      success: function (res) {
        // 授权通过：保存头像昵称
        let info = res.userInfo || {}
        let userInfo = {
          src: info.avatarUrl || '',
          nickName: info.nickName || '微信用户'
        }
        that.setData(userInfo)
        wx.setStorageSync('wxUserInfo', userInfo)
        // 第二步：调用 wx.login 获取登录凭证，完成账号登录
        that.loginByCode()
      },
      fail: function () {
        // 用户拒绝了授权
        wx.showToast({
          title: '已取消授权，无法登录',
          icon: 'none'
        })
      }
    })
  },

  // 微信账号登录第二步：wx.login 获取 code 建立登录态
  loginByCode: function () {
    let that = this
    wx.showLoading({
      title: '登录中...'
    })
    wx.login({
      success: function (res) {
        let code = res.code
        if (!code) {
          wx.hideLoading()
          wx.showToast({
            title: '获取登录凭证失败',
            icon: 'none'
          })
          return
        }
        // 本地保存登录会话（模拟后端返回的登录态）
        wx.setStorageSync('wxSession', {
          code: code,
          loginTime: Date.now()
        })
        that.setData({
          isLogin: true
        })
        that.getMyFavorites() // 登录后加载收藏
        wx.hideLoading()
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })
      },
      fail: function () {
        wx.hideLoading()
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        })
      }
    })
  },

  // 退出登录：清除本地会话与用户信息
  logout: function () {
    let that = this
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: function (res) {
        if (res.confirm) {
          wx.removeStorageSync('wxSession')
          wx.removeStorageSync('wxUserInfo')
          that.setData({
            isLogin: false,
            src: '',
            nickName: '微信用户',
            newsList: [],
            number: 0
          })
          wx.showToast({
            title: '已退出登录',
            icon: 'none'
          })
        }
      }
    })
  },

  // 一键采用微信头像（open-type="chooseAvatar" 触发，微信头像就在选择器首位）
  onChooseAvatar: function (e) {
    let url = e.detail.avatarUrl
    if (!url) return
    this.setData({
      src: url
    })
    this.saveUserInfo()
  },

  // 一键采用微信昵称（type="nickname" 键盘上方有微信昵称建议条，点一下自动填入）
  onNickInput: function (e) {
    this.setData({
      nickName: e.detail.value
    })
    this.saveUserInfo()
  },

  // 保存头像昵称到本地缓存
  saveUserInfo: function () {
    wx.setStorageSync('wxUserInfo', {
      src: this.data.src,
      nickName: this.data.nickName
    })
  },

  // 更新收藏列表
  getMyFavorites: function () {
    let info = wx.getStorageInfoSync() // 读取本地缓存信息
    let keys = info.keys               // 获取全部 key
    let myList = []
    for (let i = 0; i < keys.length; i++) {
      let obj = wx.getStorageSync(keys[i])
      // 只保留新闻结构数据（id + title），避免混入登录会话、浏览历史等其它缓存
      if (obj && obj.id && obj.title && !obj.viewTime) {
        myList.push(obj)
      }
    }
    this.setData({
      newsList: myList,
      number: myList.length
    })
  },

  // 更新浏览历史列表
  getViewHistory: function () {
    let history = wx.getStorageSync('newsViewHistory')
    if (!Array.isArray(history)) {
      history = []
    }
    // 格式化浏览时间为 yyyy-MM-dd HH:mm
    history = history.map(function (item) {
      let d = new Date(item.viewTime || Date.now())
      let pad = function (n) { return n < 10 ? '0' + n : '' + n }
      let viewTimeText = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
      return Object.assign({}, item, { viewTimeText: viewTimeText })
    })
    this.setData({
      historyList: history,
      historyNumber: history.length
    })
  },

  // 切换收藏/历史标签
  switchTab: function (e) {
    this.setData({
      activeTab: e.currentTarget.dataset.tab
    })
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    // 检查本地登录会话，恢复微信账号登录态
    let session = wx.getStorageSync('wxSession')
    if (session && session.code) {
      let userInfo = wx.getStorageSync('wxUserInfo')
      this.setData({
        isLogin: true,
        src: userInfo ? userInfo.src : '',
        nickName: userInfo ? userInfo.nickName : '微信用户'
      })
    }
    this.getViewHistory() // 浏览历史无需登录即可查看
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 刷新浏览历史（从详情页返回后最新记录置顶）
    this.getViewHistory()
    // 仅微信账号登录时加载收藏
    if (this.data.isLogin) {
      this.getMyFavorites()
    }
  },

  // 跳转到新闻详情
  goToDetail: function (e) {
    let id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '../detail/detail?id=' + id,
    })
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})

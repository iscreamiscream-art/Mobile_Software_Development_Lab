// app.js
const PROFILE_KEY = 'wx_profile'

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        traceUser: true
      })
    }

    this.globalData = {
      openid: '',
      profile: null // { nickName, avatarUrl }
    }

    // 恢复本地缓存的登录资料
    const saved = wx.getStorageSync(PROFILE_KEY)
    if (saved) {
      this.globalData.profile = saved
    }
  },

  // 保存登录资料（昵称 + 云存储头像 fileID）
  setProfile: function (profile) {
    this.globalData.profile = profile
    wx.setStorageSync(PROFILE_KEY, profile)
    return profile
  },

  // 获取 openid（已缓存则直接返回）
  fetchOpenid: function () {
    if (this.globalData.openid) return Promise.resolve(this.globalData.openid)
    return wx.cloud
      .callFunction({ name: 'getOpenid' })
      .then((res) => {
        this.globalData.openid = (res.result && res.result.openid) || ''
        return this.globalData.openid
      })
  }
})

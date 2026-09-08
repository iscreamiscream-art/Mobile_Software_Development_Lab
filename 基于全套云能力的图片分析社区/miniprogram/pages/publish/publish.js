// pages/publish/publish.js —— 发布帖子(文字 + 图片)
const db = wx.cloud.database()
const posts = db.collection('posts')
const util = require('../../utils.js')

Page({
  data: {
    content: '',
    images: [], // 待上传临时路径
    profile: null,
    submitting: false
  },

  async onLoad() {
    try {
      await util.ensureOpenid()
    } catch (e) {
      console.error(e)
    }
    this.setData({ profile: util.getProfile() })
  },

  onShow() {
    this.setData({ profile: util.getProfile() })
  },

  goLogin() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  onContent(e) {
    this.setData({ content: e.detail.value })
  },

  // 选择图片(最多9张)
  chooseImages() {
    const remain = 9 - this.data.images.length
    if (remain <= 0) {
      wx.showToast({ title: '最多9张', icon: 'none' })
      return
    }
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ images: this.data.images.concat(res.tempFilePaths) })
      }
    })
  },

  // 删除某张待选图片
  removeImage(e) {
    const idx = e.currentTarget.dataset.idx
    const arr = this.data.images.slice()
    arr.splice(idx, 1)
    this.setData({ images: arr })
  },

  // 预览待选图
  previewImg(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({ current: url, urls: this.data.images })
  },

  // 提交发布
  async submit() {
    const content = (this.data.content || '').trim()
    const images = this.data.images
    if (!content && !images.length) {
      wx.showToast({ title: '写点内容或选张图片吧', icon: 'none' })
      return
    }
    if (this.data.submitting) return

    const profile = util.getProfile()
    if (!profile || !profile.avatarUrl) {
      wx.showModal({
        title: '请先完善资料',
        content: '发布帖子前需要先授权头像并设置昵称。',
        confirmText: '去完善',
        cancelText: '再想想',
        success: (r) => {
          if (r.confirm) wx.switchTab({ url: '/pages/mine/mine' })
        }
      })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '发布中...', mask: true })
    try {
      // 1. 上传图片
      const fileIDs = []
      for (let i = 0; i < images.length; i++) {
        const ext = (images[i].match(/\.(\w+)$/) || [, 'jpg'])[1]
        const cloudPath = 'posts/' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '_' + i + '.' + ext
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: images[i] })
        fileIDs.push(up.fileID)
      }

      // 2. 写入数据库
      await posts.add({
        data: {
          nickName: profile.nickName || '微信用户',
          avatarUrl: profile.avatarUrl || '',
          region: profile.region || '',
          content: content,
          images: fileIDs,
          likedBy: [],
          favedBy: [],
          likeCount: 0,
          favCount: 0,
          shareCount: 0,
          viewCount: 0,
          addDate: util.formatTime(new Date())
        }
      })

      wx.hideLoading()
      this.setData({ submitting: false, content: '', images: [] })
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 800)
    } catch (err) {
      console.error('发布失败：', err)
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: '发布失败，请重试', icon: 'none' })
    }
  }
})

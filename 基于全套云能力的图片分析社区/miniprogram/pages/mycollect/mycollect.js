// pages/mycollect/mycollect.js —— 我的喜欢 / 我的收藏
const db = wx.cloud.database()
const posts = db.collection('posts')
const util = require('../../utils.js')

const TITLES = { like: '我的喜欢', fav: '我的收藏' }
const ACTIONS = { like: 'unlike', fav: 'unfav' }

Page({
  data: {
    type: 'like',
    title: '我的喜欢',
    list: [],
    loaded: false
  },

  async onLoad(options) {
    const type = options.type === 'fav' ? 'fav' : 'like'
    const title = TITLES[type]
    this.setData({ type, title })
    wx.setNavigationBarTitle({ title })
    await this.reload()
  },

  async reload() {
    try {
      if (!util.isLogin()) {
        this.setData({ loaded: true })
        wx.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      const key = await util.getLikeKey()
      const field = this.data.type === 'fav' ? 'favedBy' : 'likedBy'
      const res = await posts.where({ [field]: key }).orderBy('addDate', 'desc').get()
      this.setData({ list: res.data, loaded: true })
    } catch (err) {
      console.error('加载失败：', err)
      this.setData({ loaded: true })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 点卡片进入详情查看
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  // 预览图片(不冒泡跳详情)
  preview(e) {
    const url = e.currentTarget.dataset.url
    const id = e.currentTarget.dataset.id
    const post = this.data.list.find((p) => p._id === id) || {}
    wx.previewImage({ current: url, urls: post.images || [url] })
  },

  // 长按单项：取消(赞/藏)
  onLongPress(e) {
    const id = e.currentTarget.dataset.id
    wx.showActionSheet({
      itemList: [this.data.type === 'like' ? '取消点赞' : '取消收藏'],
      itemColor: '#e64340',
      success: async (r) => {
        if (r.tapIndex !== 0) return
        await this.removeOne(id)
      }
    })
  },

  async removeOne(id) {
    try {
      const key = await util.getLikeKey()
      await util.interact(id, ACTIONS[this.data.type], key)
      this.setData({ list: this.data.list.filter((p) => p._id !== id) })
      wx.showToast({ title: '已移除', icon: 'none' })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 一键清理
  onClear() {
    if (!this.data.list.length) return
    const verb = this.data.type === 'like' ? '点赞' : '收藏'
    wx.showModal({
      title: '一键清理',
      content: '确定清空全部' + verb + '吗？',
      confirmText: '全部清除',
      confirmColor: '#e64340',
      success: async (r) => {
        if (!r.confirm) return
        wx.showLoading({ title: '清理中...', mask: true })
        try {
          const key = await util.getLikeKey()
          const ids = this.data.list.slice()
          await Promise.all(ids.map((p) => util.interact(p._id, ACTIONS[this.data.type], key).catch(() => {})))
          wx.hideLoading()
          this.setData({ list: [] })
          wx.showToast({ title: '已清理', icon: 'success' })
        } catch (err) {
          console.error(err)
          wx.hideLoading()
          wx.showToast({ title: '清理失败', icon: 'none' })
        }
      }
    })
  }
})

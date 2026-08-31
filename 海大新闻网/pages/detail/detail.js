// pages/detail/detail.js
var common = require('../../utils/common.js')
Page({

  /**
   * 页面的初始数据
   */
  data: {
    article: null, //当前新闻（为空时展示空状态）
    isAdd: false   //是否已收藏
  },
  //添加收藏
  addFavorites: function () {
    let article = this.data.article
    //边界处理：文章未加载成功时禁止收藏
    if (!article || !article.id) {
      wx.showToast({
        title: '文章数据异常，请重试',
        icon: 'none'
      })
      return
    }
    wx.setStorageSync(article.id, article)
    this.setData({
      isAdd: true
    })
    wx.showToast({
      title: '收藏成功',
      icon: 'success'
    })
  },
  //取消收藏
  cancelFavorites: function () {
    let article = this.data.article
    //边界处理：文章未加载成功时禁止取消收藏
    if (!article || !article.id) {
      wx.showToast({
        title: '文章数据异常，请重试',
        icon: 'none'
      })
      return
    }
    wx.removeStorageSync(article.id)
    this.setData({
      isAdd: false
    })
    wx.showToast({
      title: '已取消收藏',
      icon: 'none'
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
   onLoad: function (options) {
    //边界处理：缺少 id 参数时直接返回，避免后续渲染/收藏报错
    if( !options || !options.id ){
      return
    }
    let id = options.id

    //检查当前新闻是否在收藏夹中（未命中存储时返回 ''，需校验内容有效性）
    var newarticle = wx.getStorageSync(id)
    //已存在
    if( newarticle && newarticle.id ){
      this.setData({
        isAdd:true,
        article:newarticle
      })
      wx.setNavigationBarTitle({ title: newarticle.title })
    }
    //不存在
    else{
      let result = common.getNewsDetail(id)
      //获取新闻内容
      if( result.code === '200' ){
        this.setData({
          article:result.news,
          isAdd:false
        })
        wx.setNavigationBarTitle({ title: result.news.title })
      } else {
        //未找到对应新闻，给出提示
        wx.showToast({
          title: '新闻不存在',
          icon: 'none'
        })
      }
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    let article = this.data.article
    return {
      title: article ? article.title : '海大新闻网',
      path: '/pages/detail/detail?id=' + (article ? article.id : '')
    }
  }
})
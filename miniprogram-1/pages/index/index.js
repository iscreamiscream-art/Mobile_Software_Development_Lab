// index.js
const app = getApp()

Page({
 data:{
  wording:'girl'
 },
 onClick:function(){
  let now = this.data.wording
  if(now === 'girl'){
    this.setData({
      wording:'boy'
    })
  }else{
    this.setData({
      wording:'girl'
    })
  }
}
})

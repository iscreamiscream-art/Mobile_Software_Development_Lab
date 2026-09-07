/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Logger from '../common/util/Logger';
import CalculateUtil from '../common/util/CalculateUtil';
import CheckEmptyUtil from '../common/util/CheckEmptyUtil';
import keysModel from '../viewmodel/PresskeysViewModel';
import { PressKeyItem } from '../viewmodel/PressKeysItem';
import { CommonConstants, Symbol } from '../common/constants/CommonConstants';
import { common } from '@kit.AbilityKit';

@Entry
@Component
struct HomePage {
  @State @Watch('inputValueChange') inputValue: string = '';
  @State calValue: string = '';
  private expressions: Array<string> = [];
  @State lastBtnIsEqu: boolean = false;
  uiContext = this.getUIContext();
  @StorageLink('topRectHeight') topRectHeight: number = 0;
  @StorageLink('bottomRectHeight') bottomRectHeight: number = 0;

  // 自定义键盘（宽高设为0）
  @Builder
  CustomKeyboardBuilder() {
    Column() {
      Grid() {
        // 键盘内容（实际不可见）
      }
      .height(0)
      .width(0);
    };
  }

  inputValueChange() {
    // Apply thousand separators for display (idempotent).
    this.inputValue = this.resultFormat(this.inputValue);
  }

  build() {
    Column() {
      // title
      Column() {
        Row() {
          Text($r('app.string.homepage_text1'))
            .width(128)
            .height(32)
            .fontSize(26)
            .fontWeight(700)
            .lineHeight(35)
            .fontColor('rgba(0, 0, 0, 0.9)')
            .fontFamily(CommonConstants.FONT_FAMILY_1)
            .margin({ left: CommonConstants.COMPONENT_BAY_SIZE_16 });
        }
        .width('100%')
        .height(32)
        .alignItems(VerticalAlign.Center)
        .justifyContent(FlexAlign.SpaceBetween);
      }
      .justifyContent(FlexAlign.Center)
      .width('100%')
      .height(54)
      .margin({ top: this.uiContext.px2vp(this.topRectHeight) });

      Column() {
        // input
        TextArea({ text: this.resultFormat(this.inputValue) })
          .selectionMenuHidden(true)
          .customKeyboard(this.CustomKeyboardBuilder())
          .visibility(Visibility.Visible)
          .fontSize(48)
          .focusable(true)
          .lineHeight(64)
          .maxLines(6)
          .fontColor(Color.Black)
          .textAlign(TextAlign.End)
          .align(Alignment.End)
          .backgroundColor($r('app.color.all_back_color'))
          .margin({
            top: 20
          });
        // result
        Text(this.resultFormat(this.calValue))
          .fontSize(26)
          .fontWeight(CommonConstants.FONT_WEIGHT_MEDIUM)
          .fontFamily(CommonConstants.FONT_FAMILY_1)
          .fontColor('rgba(0, 0, 0, 0.6)')
          .margin({ right: 16 })
          .textAlign(TextAlign.End)
          .maxLines(1);
      }
      .width(360)
      .height(224)
      .alignItems(HorizontalAlign.End)
      .justifyContent(FlexAlign.Start);


      // 键盘
      Column() {
        // 外部
        Row() {
          ForEach(keysModel.getPressKeys(), (columnItem: Array<PressKeyItem>, columnItemIndex?: number) => {
            // 键盘每一列
            Column() {
              ForEach(columnItem, (keyItem: PressKeyItem, keyItemIndex?: number) => {
                Column() {
                  if (keyItem.flag === 0) {
                    Image(keyItem.source !== undefined ? keyItem.source : '')
                      .width(keyItem.width)
                      .height(keyItem.height);
                  } else if (keyItem.flag === 3) {
                    Text(keyItem.value)
                      .lineHeight(48)
                      .fontSize(36)
                      .fontColor(Color.White)
                      .width(keyItem.width)
                      .height(keyItem.height)
                      .textAlign(TextAlign.Center);
                  } else {
                    Text(keyItem.value)
                      .fontColor(keyItem.flag === 2 ? 'rgba(10, 89, 247, 1)' : Color.Black)
                      .fontSize(keyItem.width)
                      .width('100%')
                      .height(56)
                      .lineHeight(keyItem.height)
                      .textAlign(TextAlign.Center);
                  }
                }
                .shadow({ radius: 4, color: 'rgba(0, 0, 0, 0.15)' })
                .width(64)
                .height(
                  // 判断是否是最后一个元素，决定高度
                  ((columnItemIndex === (keysModel.getPressKeys().length - 1)) &&
                    (keyItemIndex === (columnItem.length - 1))) ?
                    148 : 56
                )
                .borderColor($r('app.color.border_color'))
                .borderRadius(
                  ((columnItemIndex === (keysModel.getPressKeys().length - 1)) &&
                    (keyItemIndex === (columnItem.length - 1))) ?
                    40 : 32
                )
                .backgroundColor(
                  ((columnItemIndex === (keysModel.getPressKeys().length - 1)) &&
                    (keyItemIndex === (columnItem.length - 1))) ?
                    $r('app.color.equals_back_color') : 'rgb(255, 255, 255)'
                )
                .alignItems(HorizontalAlign.Center)
                .justifyContent(FlexAlign.Center)
                .onClick(() => {
                  // 根据flag判断是数字还是符号
                  if (keyItem.flag === 0 || keyItem.flag === 2 || keyItem.flag === 3) {
                    this.inputSymbol(keyItem.value);
                  } else {
                    if (this.lastBtnIsEqu) {
                      this.expressions = [];
                    }
                    this.lastBtnIsEqu = false;
                    this.inputNumber(keyItem.value);
                  }
                })
                .width(64);
              }, (keyItem: PressKeyItem) => JSON.stringify(keyItem));
            }
            .justifyContent(FlexAlign.SpaceBetween)
            .alignItems(HorizontalAlign.Center)
            .height('100%');
          }, (item: Array<Array<PressKeyItem>>) => JSON.stringify(item));
        }
        .padding({
          top: 16,
          left: 16,
          right: 16,
          bottom: this.uiContext.px2vp(this.bottomRectHeight) + 16
        })
        .width('100%')
        .alignItems(VerticalAlign.Center)
        .justifyContent(FlexAlign.SpaceBetween);
      }
      .width('100%')
      // .height(470)
      .layoutWeight(1)
      .borderRadius({ topLeft: 16, topRight: 16 })
      .alignItems(HorizontalAlign.Center)
      .backgroundColor('rgb(241, 243, 245)');
    }
    .width('100%')
    .height(CommonConstants.FULL_PERCENT)
    .backgroundColor($r('app.color.all_back_color'));
  }

  /**
   * Input Symbols.
   * 输入
   *
   * @param value Input Operators.
   */
  inputSymbol(value: string) {
    if (CheckEmptyUtil.isEmpty(value)) {
      return;
    }
    let len = this.expressions.length;
    this.lastBtnIsEqu = false;
    switch (value) {
      case Symbol.CLEAN:
        this.expressions = [];
        this.calValue = '';
        break;
      case Symbol.DEL:
        this.inputDelete(len);
        break;
      case Symbol.SQRT:
      case Symbol.SQUARE:
      case Symbol.RECIPROCAL:
        this.unaryOperation(value);
        break;
      case Symbol.EQU:
        if (len === 0) {
          return;
        }
        this.getResult().then((result: boolean) => {
          if (!result) {
            return;
          }
          let finalValue = this.calValue;
          this.inputValue = finalValue;
          this.calValue = '';
          this.expressions = [];
          this.expressions.push(finalValue);
          this.lastBtnIsEqu = true;
        });
        break;
      default:
        this.inputOperators(len, value);
        break;
    }
    this.formatInputValue();
  }

  /**
   * Unary operations (开方 √ / 平方 x² / 倒数 1/x).
   * The operation is applied to the operand that is currently being entered;
   * it is ignored when no operand exists (e.g. right after an operator).
   *
   * @param value Unary operator (Symbol.SQRT / Symbol.SQUARE / Symbol.RECIPROCAL).
   */
  unaryOperation(value: string) {
    let len = this.expressions.length;
    if (len === 0) {
      return;
    }
    let tail = this.expressions[len - 1];
    if (CalculateUtil.isSymbol(tail)) {
      // e.g. "5 + √": wait for a number to operate on.
      return;
    }
    // A percent operand like "50%" means 0.5 before the unary operation.
    let text = tail;
    if (tail.endsWith(CommonConstants.PERCENT_SIGN)) {
      text = tail.substring(0, tail.length - 1);
    }
    let numberValue = Number(text);
    if (Number.isNaN(numberValue)) {
      return;
    }
    if (tail.endsWith(CommonConstants.PERCENT_SIGN)) {
      numberValue /= CommonConstants.ONE_HUNDRED_NUMBER;
    }
    let calResult: number = 0;
    if (value === Symbol.SQRT) {
      if (numberValue < 0) {
        this.calValue = this.resourceToString($r('app.string.error'));
        return;
      }
      calResult = Math.sqrt(numberValue);
    } else if (value === Symbol.SQUARE) {
      calResult = numberValue * numberValue;
    } else if (value === Symbol.RECIPROCAL) {
      calResult = 1 / numberValue;
    } else {
      return;
    }
    let result = CalculateUtil.numberToScientificNotation(calResult);
    if (result === 'NaN') {
      this.calValue = this.resourceToString($r('app.string.error'));
      return;
    }
    this.expressions[len - 1] = result;
    if (len === 1) {
      this.lastBtnIsEqu = true;
    }
    this.getResult();
  }

  /**
   * Enter numbers.
   * 结果
   *
   * @param value Enter numbers.
   */
  inputNumber(value: string) {
    if (CheckEmptyUtil.isEmpty(value)) {
      return;
    }
    // After "=" a new number starts a fresh calculation.
    if (this.lastBtnIsEqu) {
      this.expressions = [];
      this.lastBtnIsEqu = false;
    }
    let len = this.expressions.length;
    let last = len > 0 ? this.expressions[len - 1] : '';
    if (!this.validateEnter(last, value)) {
      return;
    }
    if (!last || CalculateUtil.isSymbol(last)) {
      // A lone minus is the negative sign of the operand only when it is at the
      // beginning of the expression or follows another operator, e.g. "5 × -3".
      let minusIsSign: boolean = false;
      if (last === CommonConstants.MIN) {
        minusIsSign = (len === 1) ||
          CalculateUtil.isSymbol(this.expressions[len - CommonConstants.TWO]);
      }
      if (minusIsSign) {
        this.expressions[len - 1] +=
          (value === CommonConstants.DOTS ? CommonConstants.ZERO_DOTS : value);
      } else {
        // Start a new operand; a decimal point at the start becomes "0.".
        this.expressions.push(value === CommonConstants.DOTS ? CommonConstants.ZERO_DOTS : value);
      }
    } else {
      // Extend the operand that is currently being entered.
      if (value === CommonConstants.PERCENT_SIGN && last.endsWith(CommonConstants.DOTS)) {
        // "5." followed by "%" is treated as "5%".
        this.expressions[len - 1] =
          last.substring(0, last.length - 1) + CommonConstants.PERCENT_SIGN;
      } else {
        this.expressions[len - 1] += value;
      }
    }
    this.formatInputValue();
    if (value !== CommonConstants.DOTS) {
      this.getResult();
    }
  }

  /**
   * Verify that you can enter.
   *
   * @param last Value of the last element.
   * @param value Current input value.
   * return Indicates whether to allow input.
   */
  validateEnter(last: string, value: string) {
    // Percent cannot begin an operand.
    if (value === CommonConstants.PERCENT_SIGN) {
      if (CheckEmptyUtil.isEmpty(last) || CalculateUtil.isSymbol(last)) {
        return false;
      }
      if (last.endsWith(CommonConstants.PERCENT_SIGN)) {
        return false;
      }
    }
    // Percent is terminal: nothing may be typed behind it on the same number.
    if (last.endsWith(CommonConstants.PERCENT_SIGN)) {
      return false;
    }
    // A number may only contain a single decimal point.
    if ((last.indexOf(CommonConstants.DOTS) !== -1) && (value === CommonConstants.DOTS)) {
      return false;
    }
    // Leading zero: "0" can only be followed by "." or "%".
    if ((last === CommonConstants.ZERO) && (value !== CommonConstants.DOTS) &&
      (value !== CommonConstants.PERCENT_SIGN)) {
      return false;
    }
    return true;
  }

  /**
   * Delete Key Trigger.
   *
   * @param len Expression Length.
   */
  inputDelete(len: number) {
    if (len === 0) {
      return;
    }
    let last = this.expressions[len - 1];
    let lastLen = last.length;
    if (lastLen === 1) {
      this.expressions.pop();
      len = this.expressions.length;
    } else {
      this.expressions[len - 1] = last.slice(0, last.length - 1);
    }
    if (len === 0) {
      this.inputValue = '';
      this.calValue = '';
      return;
    }
    if (!CalculateUtil.isSymbol(this.expressions[len - 1])) {
      this.getResult();
    }
  }

  /**
   * Triggered when input is added, subtracted, multiplied, and divided.
   *
   * @param len Expression Length.
   * @param value Current Input Value.
   */
  inputOperators(len: number, value: string) {
    let last = len > 0 ? this.expressions[len - 1] : undefined;
    let secondLast = len > 1 ? this.expressions[len - CommonConstants.TWO] : undefined;
    if (!last && (value === Symbol.MIN)) {
      this.expressions.push(this.getSymbol(value));
      return;
    }
    if (!last) {
      return;
    }
    if (!CalculateUtil.isSymbol(last)) {
      this.expressions.push(this.getSymbol(value));
      return;
    }
    if ((value === Symbol.MIN) &&
      (last === CommonConstants.MIN || last === CommonConstants.ADD)) {
      this.expressions.pop();
      this.expressions.push(this.getSymbol(value));
      return;
    }
    if (!secondLast) {
      return;
    }
    if (value !== Symbol.MIN) {
      this.expressions.pop();
    }
    if (CalculateUtil.isSymbol(secondLast)) {
      this.expressions.pop();
    }
    this.expressions.push(this.getSymbol(value));
  }

  /**
   * Get Operator.
   *
   * @param value.
   * @return Operators.
   */
  getSymbol(value: string) {
    if (CheckEmptyUtil.isEmpty(value)) {
      return '';
    }
    let symbol = '';
    switch (value) {
      case Symbol.ADD:
        symbol = CommonConstants.ADD;
        break;
      case Symbol.MIN:
        symbol = CommonConstants.MIN;
        break;
      case Symbol.MUL:
        symbol = CommonConstants.MUL;
        break;
      case Symbol.DIV:
        symbol = CommonConstants.DIV;
        break;
      default:
        break;
    }
    return symbol;
  }

  /**
   * Make a deep copy of an expression.
   *
   * @return deep copy expression.
   */
  deepCopy(): Array<string> {
    let copyExpressions: Array<string> = Array.from(this.expressions);
    return copyExpressions;
  }

  /**
   * Obtaining Results.
   *
   * @return Whether the result is incorrect.
   */
  async getResult() {
    let calResult = CalculateUtil.parseExpression(this.deepCopy());
    if (calResult === 'NaN') {
      this.calValue = this.resourceToString($r('app.string.error'));
      return false;
    }
    this.calValue = calResult;
    return true;
  }

  /**
   * Number Formatting.
   *
   * Inserts thousand separators only into the integer parts of numbers.
   * Fractional parts, scientific-notation exponents and operators are kept
   * untouched, and already-formatted strings stay unchanged (idempotent).
   *
   * @param value Formatting parameters.
   * @return Thousand percentile data.
   */
  resultFormat(value: string) {
    if (CheckEmptyUtil.isEmpty(value)) {
      return '';
    }
    let output = '';
    let digitRun = '';
    let inFraction = false;
    for (let i = 0; i < value.length; i++) {
      let ch = value.charAt(i);
      if (ch >= '0' && ch <= '9') {
        if (inFraction) {
          output += ch;
        } else {
          digitRun += ch;
        }
        continue;
      }
      output += this.groupDigits(digitRun);
      digitRun = '';
      if (ch === CommonConstants.DOTS) {
        inFraction = true;
      } else {
        inFraction = false;
      }
      output += ch;
    }
    output += this.groupDigits(digitRun);
    return output;
  }

  /**
   * Insert commas into a plain run of digits (from the right, every 3 digits).
   *
   * @param digits A run of digit characters.
   * @return The digits with thousand separators.
   */
  groupDigits(digits: string): string {
    if (digits.length <= 3) {
      return digits;
    }
    let grouped = '';
    let count = 0;
    for (let i = digits.length - 1; i >= 0; i--) {
      grouped = digits.charAt(i) + grouped;
      count++;
      if (count % 3 === 0 && i !== 0) {
        grouped = ',' + grouped;
      }
    }
    return grouped;
  }

  /**
   * Convert a resource file to a string.
   *
   * @param resource Resource file.
   * @return Character string converted from the resource file.
   */
  resourceToString(resource: Resource): string {
    if (CheckEmptyUtil.isEmpty(resource)) {
      return '';
    }
    let result = '';
    try {
      result = (this.uiContext.getHostContext() as common.UIAbilityContext).resourceManager.getStringSync(resource.id);
    } catch (error) {
      Logger.error('[CalculateModel] getResourceString fail: ' + JSON.stringify(error));
    }
    return result;
  }

  /**
   * Thousands in the formatting result.
   */
  formatInputValue() {
    let deepExpressions: Array<string> = [];
    this.deepCopy().forEach((item: string, index: number) => {
      deepExpressions[index] = this.resultFormat(item);
    });
    this.inputValue = deepExpressions.join('');
  }
}
module.exports = function (RED) {
  const convert = require("color-convert");
  function InovelliLEDManager(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    const {
      zwave,
      nodeid,
      entityid,
      switchtype,
      lightColor,
      lightBrightness,
      lightBrightnessOff,
      fanColor,
      fanBrightness,
      fanBrightnessOff,
    } = config;

    this.zwave = zwave;
    this.entityid = entityid;
    this.nodeid = nodeid;
    this.switchtype = parseInt(switchtype, 10);
    this.lightColor = parseInt(lightColor, 10);
    this.lightBrightness = parseInt(lightBrightness, 10);
    this.lightBrightnessOff = parseInt(lightBrightnessOff, 10);
    this.fanColor = parseInt(fanColor, 10);
    this.fanBrightness = parseInt(fanBrightness, 10);
    this.fanBrightnessOff = parseInt(fanBrightnessOff, 10);

    node.on("input", (msg) => {
      const {
        zwave: presetZwave,
        entityid,
        nodeid,
        switchtype: presetSwitchtype,
        lightColor: presetLightColor,
        lightBrightness: presetLightBrightness,
        lightBrightnessOff: presetLightBrightnessOff,
        fanColor: presetFanColor,
        fanBrightness: presetFanBrightness,
        fanBrightnessOff: presetFanBrightnessOff,
      } = node;
      
      const payload = msg.payload || {};
      const domain = payload.zwave || presetZwave;
      var parameter = payload.switchtype || presetSwitchtype;
      var lightColor = payload.lightColor || presetLightColor;
      const lightBrightness = payload.lightBrightness || presetLightBrightness;
      const lightBrightnessOff =
        payload.lightBrightnessOff || presetLightBrightnessOff;
      var fanColor = payload.fanColor || presetFanColor;
      const fanBrightness = payload.fanBrightness || presetFanBrightness;
      const fanBrightnessOff =
        payload.fanBrightnessOff || presetFanBrightnessOff;
      var error = 0;

      function inputSwitchConvert(parameter) {
        if (isNaN(parameter)) {
          parameter = parameter.toLowerCase();
          var switchConvert;
          if (["switch", "lzw30", "lzw30-sn"].includes(parameter)) {
            switchConvert = 5;
          } else if (["dimmer", "lzw31", "lzw31-sn"].includes(parameter)) {
            switchConvert = 13;
          } else if (["combo_light", "lzw36_light"].includes(parameter)) {
            switchConvert = 18;
          } else if (["combo_fan", "lzw36_fan", "fan"].includes(parameter)) {
            switchConvert = 20;
          } else if (
            ["lzw36", "fan and light", "light and fan"].includes(parameter)
          ) {
            switchConvert = 38;
          }
          if (switchConvert !== undefined) {
            parameter = switchConvert;
          } else {
            node.error(`Incorrect Switch Type: ${parameter}`);
            error++;
          }
        } else if (![5, 13, 18, 20, 38].includes(parameter)) {
          node.error(
            `Incorrect Switch Value: ${parameter}. Valid values are 5, 13, 18, 20, or 38.`
          );
          error++;
        }
        return parameter;
      }

      function inputColorConvert(color, source, presetColor) {
        if (Array.isArray(color) && typeof color === "object") {
          if (color.length === 3) {
            rgb = color;
          } else {
            node.error(`Check your RGB values for ${source}: ${color}`);
            error++;
          }
        } else if (typeof color === "string") {
          if (color.startsWith("#") === true) {
            rgb = convert.hex.rgb(color);
          } else {
            color = color.replace(" ", "").toLowerCase();
            rgb = convert.keyword.rgb(color);
          }
        } else if (typeof color === "number") {
          if (color >= 0 && color <= 360) {
            let conv_hsv = [color, 100, 100];
            rgb = convert.hsv.rgb(conv_hsv);
          } else {
            node.error(`Incorrect Hue Value for ${source}: ${color}`);
            error++;
          }
        } else {
          node.error(
            `Incorrect Color for ${source}: ${color}. Using default color: Red`
          );
        }
        if (rgb === undefined) {
          node.error(
            `Incorrect Color for ${source}: ${color}. Using preset color value: ${presetColor}`
          );
          let conv_hsv = [presetColor, 100, 100];
          rgb = convert.hsv.rgb(conv_hsv);
        }
        return rgb;
      }

      function inputBrightnessCheck(brightness, source) {
        if (brightness < 0 || brightness > 11) {
          node.error(
            `Invalid brightness value for brightness while ${source}: ${brightness}. Please enter a value between 0 and 10.`
          );
          error++;
        }
      }

      function inputDomainCheck(domain) {
        if (!["ozw", "zwave", "zwave_js"].includes(domain)) {
          node.error(
            `Invalid Z-Wave domain: ${domain}. Supported domains are zwave, ozw, or zwave_js.`
          );
          error++;
        }
      }

      inputDomainCheck(domain);
      parameter = inputSwitchConvert(parameter);

      switch (parameter) {
        case 38:
          lightColor = inputColorConvert(lightColor, "Light", presetLightColor);
          inputBrightnessCheck(lightBrightness, "on");
          inputBrightnessCheck(lightBrightnessOff, "off");
          fanColor = inputColorConvert(fanColor, "Fan", presetFanColor);
          inputBrightnessCheck(fanBrightness, "on");
          inputBrightnessCheck(fanBrightnessOff, "off");
          break;
        case 20:
          fanColor = inputColorConvert(fanColor, "Fan", presetFanColor);
          inputBrightnessCheck(fanBrightness, "on");
          inputBrightnessCheck(fanBrightnessOff, "off");
          break;
        default:
          lightColor = inputColorConvert(lightColor, "Light", presetLightColor);
          inputBrightnessCheck(lightBrightness, "on");
          inputBrightnessCheck(lightBrightnessOff, "off");
          break;
      }

      function generateMsg(id) {
        let lightHSL,
          fanHSL,
          lightKeyword,
          fanKeyword,
          lightHue,
          fanHue,
          params;
        switch (parameter) {
          case 38:
            lightHSL = [convert.rgb.hsl(lightColor)[0], 100, 50];
            lightKeyword = convert.rgb.keyword(convert.hsl.rgb(lightHSL));
            lightHue = parseInt((lightHSL[0] * (17 / 24)).toFixed(0));
            fanHSL = [convert.rgb.hsl(fanColor)[0], 100, 50];
            fanKeyword = convert.rgb.keyword(convert.hsl.rgb(fanHSL));
            fanHue = parseInt((fanHSL[0] * (17 / 24)).toFixed(0));
            node.status(
              `Set Fan Color: ${fanKeyword}; Set Light Color: ${lightKeyword}`
            );
            params = {
              18: { value: lightHue, size: 2 },
              19: { value: lightBrightness, size: 1 },
              20: { value: fanHue, size: 2 },
              21: { value: fanBrightness, size: 1 },
              22: { value: lightBrightnessOff, size: 1 },
              23: { value: fanBrightnessOff, size: 1 },
            };
            break;
          case 20:
            fanHSL = [convert.rgb.hsl(fanColor)[0], 100, 50];
            fanKeyword = convert.rgb.keyword(convert.hsl.rgb(fanHSL));
            fanHue = parseInt((fanHSL[0] * (17 / 24)).toFixed(0));
            node.status(
              `Fan Color: ${fanKeyword}, On/Off:${fanBrightness}/${fanBrightnessOff}`
            );
            params = {
              20: { value: fanHue, size: 2 },
              21: { value: fanBrightness, size: 1 },
              23: { value: fanBrightnessOff, size: 1 },
            };
            break;
          case 18:
            lightHSL = [convert.rgb.hsl(lightColor)[0], 100, 50];
            lightKeyword = convert.rgb.keyword(convert.hsl.rgb(lightHSL));
            lightHue = parseInt((lightHSL[0] * (17 / 24)).toFixed(0));
            node.status(
              `Light Color: ${lightKeyword}, On/Off:${lightBrightness}/${lightBrightnessOff}`
            );
            params = {
              18: { value: lightHue, size: 2 },
              19: { value: lightBrightness, size: 1 },
              22: { value: lightBrightnessOff, size: 1 },
            };
            break;
          case 13:
            lightHSL = [convert.rgb.hsl(lightColor)[0], 100, 50];
            lightKeyword = convert.rgb.keyword(convert.hsl.rgb(lightHSL));
            lightHue = parseInt((lightHSL[0] * (17 / 24)).toFixed(0));
            node.status(
              `Light Color: ${lightKeyword}, On/Off:${lightBrightness}/${lightBrightnessOff}`
            );
            params = {
              13: { value: lightHue, size: 2 },
              14: { value: lightBrightness, size: 1 },
              15: { value: lightBrightnessOff, size: 1 },
            };
            break;
          case 5:
            lightHSL = [convert.rgb.hsl(lightColor)[0], 100, 50];
            lightKeyword = convert.rgb.keyword(convert.hsl.rgb(lightHSL));
            lightHue = parseInt((lightHSL[0] * (17 / 24)).toFixed(0));
            node.status(
              `Light Color: ${lightKeyword}, On/Off:${lightBrightness}/${lightBrightnessOff}`
            );
            params = {
              5: { value: lightHue, size: 2 },
              6: { value: lightBrightness, size: 1 },
              7: { value: lightBrightnessOff, size: 1 },
            };
            break;
        }
        for (let x in params) {
          parameter = parseInt(x);
          value = parseInt(params[x].value);
          let size = parseInt(params[x].size);
          size = domain === "zwave" ? { size } : {};
          if (domain !== "zwave_js" && id.node_id.includes(",")) {
            const nodes = id.node_id.split(",").map(Number);
            for (let y in nodes) {
              node_id = nodes[y];
              if (isNaN(node_id)) {
                node.error(
                  `Invalid Node ID List. Please make sure your list of Node IDs contains integers seprated by commas.`
                );
                node.status({
                  fill: "red",
                  shape: "ring",
                  text: "Error! Check debug window for more info",
                });
              } else {
                let data = { node_id, ...size, parameter, value };
                sendMsg(data);
              }
            }
          } else {
            let data = { ...id, parameter, ...size, value };
            sendMsg(data);
          }
        }
      }

      function sendMsg(data) {
        var service = "set_config_parameter";
        node.send({
          payload: {
            domain,
            service,
            data,
          },
        });
      }

      if (error === 0) {
        var id;
        switch (domain) {
          case "zwave_js":
            const entity_id = payload.entity_id || entityid;
            id = entity_id ? { entity_id } : {};
            generateMsg(id);
            break;
          default:
            var node_id = payload.node_id || nodeid;
            id = node_id ? { node_id } : {};
            generateMsg(id);
            break;
        }
      } else {
        node.status(`Error! Check debug window for more info`);
      }
    });
  }
  RED.nodes.registerType("inovelli-led-manager", InovelliLEDManager);
};

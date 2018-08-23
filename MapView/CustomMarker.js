import React, { Component } from 'react';
import { Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

export default class CustomMarker extends Component {
  shouldComponentUpdate(nextProps) {
    return !(this.props.geometry === nextProps.geometry
      && this.props.pointCount === nextProps.pointCount);
  }

  render() {
    let { pointCount, geometry, isShowPickedCluster, isCurrentMarker, onClusterPress, index, marker,
      clusterStyle, clusterTextStyle, currentClusterStyle, currentClusterTextStyle } = this.props
    if (pointCount > 0) {
      if (!geometry || geometry === []) {
        return null
      }
      
      if (isShowPickedCluster && isCurrentMarker) {
        clusterTextStyle = { ...clusterTextStyle, ...currentClusterTextStyle }
        clusterStyle = { ...clusterStyle, ...currentClusterStyle }
        pointCount = ` ${pointCount} `
      }

      return (
        <Marker
          coordinate={{
            longitude: geometry.coordinates[0],
            latitude: geometry.coordinates[1],
          }}
          onPress={pointCount > 0 && onClusterPress(index)}
        >
          <View style={clusterStyle}>
            <Text style={clusterTextStyle}>
              {pointCount}
            </Text>
          </View>
        </Marker>
      );
    }
    return marker;
  }
}

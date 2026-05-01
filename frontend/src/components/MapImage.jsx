import { useEffect } from 'react';
import { Image as KonvaImage, Text } from 'react-konva';
import useImage from 'use-image';

const MapImage = ({ onImageLoad }) => {
    const [image, status] = useImage(`${import.meta.env.BASE_URL}map.jpg`);

    useEffect(() => {
        if (status === 'loaded' && image && onImageLoad) {
            onImageLoad({ width: image.width, height: image.height });
        }
    }, [status, image]);  // eslint-disable-line react-hooks/exhaustive-deps

    if (status === 'failed') {
        return <Text text="Failed to load map.jpg" fill="red" fontSize={40} x={100} y={100} />;
    }

    return <KonvaImage image={image} width={4935} height={3825} />;
};

export default MapImage;

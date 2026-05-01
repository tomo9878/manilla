import { Group, Rect, Image as KonvaImage, Text } from 'react-konva';
import useImage from 'use-image';

const BASE = import.meta.env.BASE_URL;
const UNIT_SIZE = 100;

const UnitCounter = ({ unit, x, y, isSelected, onClick, onDblClick, onContextMenu }) => {
    const [frontImg] = useImage(`${BASE}images/${unit.frontImage}`);
    const [backImg] = useImage(unit.backImage ? `${BASE}images/${unit.backImage}` : null);

    const showBack = unit.status === 'spent' || unit.status === 'revealed';
    const currentImage = (showBack && backImg) ? backImg : frontImg;

    return (
        <Group
            x={x}
            y={y}
            onClick={(e) => { e.cancelBubble = true; onClick && onClick(unit.id); }}
            onContextMenu={(e) => { e.evt.preventDefault(); onContextMenu && onContextMenu(e.evt, unit.id); }}
            onDblClick={(e) => { e.cancelBubble = true; onDblClick && onDblClick(unit.id); }}

        >
            <Rect width={UNIT_SIZE} height={UNIT_SIZE} fill="black" opacity={0.3} offsetX={-3} offsetY={-3} />
            <Rect
                width={UNIT_SIZE}
                height={UNIT_SIZE}
                fill="#dcb"
                stroke={isSelected ? 'yellow' : (unit.status === 'spent' ? 'red' : 'black')}
                strokeWidth={isSelected ? 4 : (unit.status === 'spent' ? 2 : 1)}
            />
            {currentImage
                ? <KonvaImage image={currentImage} width={UNIT_SIZE} height={UNIT_SIZE} />
                : <Text text={unit.name} fontSize={14} width={UNIT_SIZE} padding={5} />
            }
        </Group>
    );
};

export default UnitCounter;
export { UNIT_SIZE };

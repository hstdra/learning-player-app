import ReactPlayer from 'react-player';
import toWebVTT from 'srt-webvtt';
import { useCallback, useEffect, useState } from 'react';
import { merge } from 'lodash';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Checkbox,
  Divider,
  Grid,
  GridItem,
  HStack,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { OnProgressProps } from 'react-player/base';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

async function getVideoSecondDurationAsync(videoPath: string) {
  const buff = Buffer.alloc(100);
  const header = Buffer.from('mvhd');

  const file = await fsp.open(videoPath, 'r');
  const { buffer } = await file.read(buff, 0, 100, 0);

  await file.close();

  const start = buffer.indexOf(header) + 17;
  const timeScale = buffer.readUInt32BE(start);
  const duration = buffer.readUInt32BE(start + 4);
  const secondDuration = Math.round(((duration / timeScale) * 1000) / 1000);

  return secondDuration;
}

function toTimeString(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}m`;
  }

  if (minutes > 0) {
    return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
  }

  return `${seconds}s`;
}

const defaultProgress = {
  currentVideoId: null,
  dict: {},
};
const loadProgress = (dirPath: string) => {
  const filePath = path.join(dirPath, 'progress.json');

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return defaultProgress;
  }
};

const loadBlobFromPath = (blobPath: string) => {
  const buffer = fs.readFileSync(blobPath);
  return new Blob([buffer]);
};

const loadBlobUrlFromPath = (path: string) => {
  return URL.createObjectURL(loadBlobFromPath(path));
};

export default function Video() {
  const [dirPath, setDirPath] = useState<string>('');
  const [playingVideo, setPlayingVideo] = useState<any>(null);
  const [progress, setProgress] = useState<any>(defaultProgress);
  const [folders, setFolders] = useState<string[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const videos = sections?.flatMap(
    (section: any) => section?.videos || []
  ) as any[];

  const updateProgress = useCallback(
    (newProgress: any) => {
      const mergedProgress = merge(progress, newProgress);
      setProgress({ ...mergedProgress });
      fs.writeFileSync(
        path.join(dirPath, 'progress.json'),
        JSON.stringify(mergedProgress, null, 2)
      );
    },
    [dirPath, progress]
  );

  const playVideo = useCallback(
    async (videoId: string) => {
      const video = videos.find((x: any) => x.id === videoId);
      if (!video) return;

      const url = loadBlobUrlFromPath(video.path);
      const subtitleUrl = loadBlobFromPath(video.srtPath);
      const textTrackUrl = await toWebVTT(subtitleUrl);

      setPlayingVideo({
        url,
        config: {
          file: {
            tracks: [
              {
                kind: 'subtitles',
                src: textTrackUrl,
                srcLang: 'en',
                label: 'English',
                default: true,
                mode: 'showing',
              },
            ],
          },
        },
      });
      updateProgress({
        currentVideoId: videoId,
      });
    },
    [updateProgress, videos]
  );

  const handleClickVideo = async (videoId: string) => {
    if (progress.currentVideoId === videoId) return;

    playVideo(videoId);
  };

  const setCheckVideo = (videoId: string, checked: boolean) => {
    updateProgress({
      dict: {
        [videoId]: {
          checked,
        },
      },
    });
  };

  const onVideoProgress = (state: OnProgressProps) => {
    if (state.loaded === 1 && state.loadedSeconds - state.playedSeconds <= 3) {
      setCheckVideo(progress.currentVideoId, true);
    }

    if (state.played === 1) {
      const nextIndex = videos.findIndex(
        (video: any) => video.id === progress.currentVideoId
      );
      if (nextIndex < videos.length - 1) {
        playVideo(videos[nextIndex + 1].id);
      }
    }
  };

  const onConfirmPath = () => {
    try {
      const newFolders = fs
        .readdirSync(dirPath)
        .filter((folderName: string) =>
          fs.lstatSync(path.join(dirPath, folderName)).isDirectory()
        );

      setFolders(newFolders);
    } catch (error) {
      setDirPath('');
    }
  };

  useEffect(() => {
    if (!playingVideo && !!progress?.currentVideoId && videos.length > 0) {
      playVideo(progress.currentVideoId);
    }
  }, [progress?.currentVideoId, playingVideo, videos.length, playVideo]);

  useEffect(() => {
    if (!dirPath) return;
    if (folders.length === 0) return;

    setProgress(loadProgress(dirPath));
  }, [folders, dirPath, setProgress]);

  // Compute sections when folders changed
  useEffect(() => {
    if (folders.length === 0) return;

    const run = async () => {
      const newSections = await Promise.all(
        folders.map(async (folderName: string) => {
          const folderPath = path.join(dirPath, folderName);
          const files = fs.readdirSync(folderPath);
          const videos = await Promise.all(
            files
              .filter((fileName: string) => fileName.endsWith('.mp4'))
              .map(async (fileName: string) => {
                const videoPath = path.join(folderPath, fileName);
                const duration = await getVideoSecondDurationAsync(videoPath);
                const srtPath = path.join(
                  folderPath,
                  fileName.replace('.mp4', '.srt')
                );
                return {
                  id: `${folderName}-${fileName}`,
                  section: folderName,
                  name: fileName.replace('.mp4', '').replace(/\d+ /, ''),
                  path: videoPath,
                  srtPath,
                  duration,
                };
              })
          );

          return {
            name: folderName.replace(/\d+ /, ''),
            videos,
          };
        }) as any[]
      );

      setSections(newSections);
    };

    run();
  }, [dirPath, folders, setSections]);

  if (folders.length === 0)
    return (
      <div>
        <Input
          placeholder="Enter directory path"
          type="text"
          onChange={(e: any) => setDirPath(e.target.value)}
        />
        <Button onClick={onConfirmPath}>Submit</Button>
      </div>
    );

  return (
    <div>
      <Grid w="100%" h="100vh" templateColumns="repeat(6, 1fr)" gap={0}>
        <GridItem colSpan={4} bg="papayawhip">
          {playingVideo && (
            <ReactPlayer
              onProgress={onVideoProgress}
              width="100%"
              height="100%"
              url={playingVideo?.url}
              controls
              playing
              config={playingVideo?.config}
            />
          )}
        </GridItem>
        <GridItem colSpan={2} overflowY="auto">
          <Accordion allowMultiple>
            {sections.map((section: any, i: number) => (
              <AccordionItem key={section?.name} bg="gray.300">
                <AccordionButton>
                  <Box as="span" flex="1" textAlign="left">
                    <Heading as="h3" size="sm">
                      {i + 1}. {section?.name}
                    </Heading>
                    <Heading as="h4" size="xs" color="gray.500">
                      {
                        section.videos.filter(
                          (video: any) => progress?.dict[video?.id]?.checked
                        ).length
                      }
                      /{section.videos.length} videos |{' '}
                      {toTimeString(
                        section.videos.reduce(
                          (acc: any, video: any) => acc + video.duration,
                          0
                        )
                      )}
                    </Heading>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel p={0}>
                  <Stack p={0} spacing={0} divider={<Divider />}>
                    {section?.videos.map((video: any, i: number) => (
                      <HStack
                        w="100%"
                        p={1}
                        key={video.name}
                        bg={
                          progress?.currentVideoId === video.id
                            ? 'teal.200'
                            : 'gray.100'
                        }
                      >
                        <Checkbox
                          isChecked={progress?.dict[video?.id]?.checked}
                          onChange={(e: any) =>
                            setCheckVideo(video.id, e.target.checked)
                          }
                        />
                        <Box w={'100%'} cursor="pointer">
                          <Text onClick={() => handleClickVideo(video.id)}>
                            {i + 1}. {video.name}
                          </Text>
                          <Text color="gray.500">
                            {toTimeString(video.duration)}
                          </Text>
                        </Box>
                      </HStack>
                    ))}
                  </Stack>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </GridItem>
      </Grid>
    </div>
  );
}
